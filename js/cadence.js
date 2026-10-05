// Cadence engine: generates tasks, logs activities/outcomes, keeps contacts in sync.
import { db } from './db.js';
import { state } from './state.js';
import { addDays, today, uid, weekdayOf } from './util.js';

export const TASK_ICON = {
  call: 'phone', email: 'mail', linkedin_connect: 'linkedin', linkedin_engage: 'linkedin',
  linkedin_message: 'linkedin', mushroom: 'mushroom', research: 'research',
};
export const TYPE_LABEL = {
  call: 'Call', email: 'Email', linkedin_connect: 'LinkedIn connect', linkedin_engage: 'LinkedIn engage',
  linkedin_message: 'LinkedIn message', mushroom: 'Mushroom', research: 'Research',
};
export const TASK_GROUPS = [
  { id: 'calls', label: 'Calls', types: ['call'] },
  { id: 'emails', label: 'Emails', types: ['email'] },
  { id: 'linkedin', label: 'LinkedIn', types: ['linkedin_connect', 'linkedin_engage', 'linkedin_message'] },
  { id: 'mushroom', label: 'Mushroom', types: ['mushroom'] },
  { id: 'research', label: 'Research', types: ['research'] },
];

export function rollWeekend(day, skip = state.settings.skipWeekends) {
  if (!skip) return day;
  const w = weekdayOf(day);
  if (w === 6) return addDays(day, 2);
  if (w === 0) return addDays(day, 1);
  return day;
}

// Day 1 is the day the contact is added (rolled to Monday if it falls on a weekend).
export function dueDateFor(start, day) {
  return rollWeekend(addDays(rollWeekend(start), day - 1));
}

export function rungFor(type, variant) {
  switch (type) {
    case 'research': return 1;
    case 'linkedin_connect': return 2;
    case 'linkedin_engage': return 3;
    case 'linkedin_message': return 3;
    case 'call': return variant === 'warm' ? 7 : 4;
    case 'email': return variant === 'warm' ? 8 : 5;
    case 'mushroom': return 6;
    default: return 0;
  }
}

export function emailVariant(hint) { return /^we-|warm_email/.test(hint || '') ? 'warm' : 'cold'; }

function newTask(contactId, type, label, dueDate, templateHint, cadenceStep = -1) {
  return { id: uid(), contactId, type, label, dueDate, status: 'open', cadenceStep, templateHint: templateHint || '', completedAt: null };
}

export async function addTask(contactId, type, label, dueDate, templateHint) {
  const t = newTask(contactId, type, label, dueDate, templateHint);
  await db.put('tasks', t);
  await refreshContact(contactId);
  return t;
}

export async function generateTasks(contact, start = today()) {
  const tasks = state.settings.cadence.map((s, i) => ({
    ...newTask(contact.id, s.type, s.label, dueDateFor(start, s.day), s.templateHint, i),
    id: uid() + i,
  }));
  await db.putMany('tasks', tasks);
  await refreshContact(contact.id);
  return tasks;
}

export async function createContact(data) {
  const contact = {
    id: uid(), name: '', role: '', persona: '', company: '', site: '', sector: '',
    phone: '', email: '', linkedin: '', source: '', notes: '',
    rung: 0, status: 'active', createdAt: Date.now(), lastTouchAt: null, nextActionAt: null,
    ...data,
  };
  await db.put('contacts', contact);
  await generateTasks(contact);
  return db.get('contacts', contact.id);
}

export async function deleteContact(id) {
  const tasks = await db.byIndex('tasks', 'contactId', id);
  const acts = await db.byIndex('activities', 'contactId', id);
  await db.delMany('tasks', tasks.map((t) => t.id));
  await db.delMany('activities', acts.map((a) => a.id));
  await db.del('contacts', id);
}

export async function cancelOpenTasks(contactId) {
  const tasks = (await db.byIndex('tasks', 'contactId', contactId)).filter((t) => t.status === 'open');
  tasks.forEach((t) => { t.status = 'skipped'; });
  if (tasks.length) await db.putMany('tasks', tasks);
}

export async function restartCadence(contact) {
  await cancelOpenTasks(contact.id);
  contact.status = 'active';
  await db.put('contacts', contact);
  await generateTasks(contact);
}

export async function refreshContact(id) {
  const contact = await db.get('contacts', id);
  if (!contact) return null;
  const [tasks, acts] = await Promise.all([db.byIndex('tasks', 'contactId', id), db.byIndex('activities', 'contactId', id)]);
  const open = tasks.filter((t) => t.status === 'open').map((t) => t.dueDate).sort();
  contact.nextActionAt = open[0] || null;
  contact.lastTouchAt = acts.length ? Math.max(...acts.map((a) => a.timestamp)) : null;
  await db.put('contacts', contact);
  return contact;
}

function bumpRung(contact, type, variant) {
  if (contact.status === 'nurture' || contact.rung >= 9) return;
  contact.rung = Math.max(contact.rung || 0, rungFor(type, variant));
}

async function writeActivity(contact, a) {
  const activity = {
    id: uid(), contactId: contact ? contact.id : null, type: a.type, outcome: a.outcome || 'done',
    variant: a.variant || '', scriptIdsUsed: a.scriptIds || [], notes: a.notes || '',
    timestamp: a.timestamp || Date.now(), taskId: a.taskId || null,
  };
  await db.put('activities', activity);
  if (contact) bumpRung(contact, a.type, a.variant);
  return activity;
}

// Mark a non-call task done (email, LinkedIn, research, mushroom) and log it.
export async function completeTask(task, { notes = '', scriptIds = [], variant } = {}) {
  const contact = await db.get('contacts', task.contactId);
  const v = variant || (task.type === 'email' ? emailVariant(task.templateHint) : '');
  task.status = 'done';
  task.completedAt = Date.now();
  await db.put('tasks', task);
  await writeActivity(contact, { type: task.type, variant: v, notes, scriptIds, taskId: task.id });
  if (contact) { await db.put('contacts', contact); await refreshContact(contact.id); }
}

export async function skipTask(task) {
  task.status = 'skipped';
  await db.put('tasks', task);
  await refreshContact(task.contactId);
}

export async function rescheduleTask(task, date) {
  task.dueDate = date;
  task.status = 'open';
  await db.put('tasks', task);
  await refreshContact(task.contactId);
}

// Ad-hoc activity (e.g. "Log a call" with no task)
export async function logAdHoc({ contactId, type, outcome, notes, variant, scriptIds }) {
  const contact = contactId ? await db.get('contacts', contactId) : null;
  const act = await writeActivity(contact, { type, outcome, notes, variant, scriptIds });
  if (contact) { await db.put('contacts', contact); await refreshContact(contact.id); }
  return act;
}

async function hasOpen(contactId, type, from = today()) {
  const tasks = await db.byIndex('tasks', 'contactId', contactId);
  return tasks.some((t) => t.status === 'open' && t.type === type && t.dueDate >= from);
}

// Log a call outcome, update the contact, and schedule the next step.
export async function logCallOutcome({ contactId, taskId, outcome, notes = '', date = '', scriptIds = [], variant = 'cold' }) {
  const contact = contactId ? await db.get('contacts', contactId) : null;
  let task = taskId ? await db.get('tasks', taskId) : null;
  if (!task && contact) {
    const open = (await db.byIndex('tasks', 'contactId', contact.id))
      .filter((t) => t.status === 'open' && t.type === 'call')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    task = open[0] || null;
  }
  const activity = await writeActivity(contact, { type: 'call', outcome, variant, notes, scriptIds, taskId: task && task.id });
  if (task) { task.status = 'done'; task.completedAt = Date.now(); await db.put('tasks', task); }

  let followUp = '';
  if (contact) {
    const t0 = today();
    switch (outcome) {
      case 'meeting':
        contact.rung = 9;
        contact.meetingAt = date || '';
        await cancelOpenTasks(contact.id);
        followUp = 'Meeting booked — remaining cadence tasks cancelled';
        break;
      case 'not_interested': {
        contact.status = 'nurture';
        contact.rung = 10;
        await cancelOpenTasks(contact.id);
        const due = rollWeekend(addDays(t0, 42));
        await db.put('tasks', newTask(contact.id, 'email', 'Nurture check-in', due, 'we-c'));
        followUp = 'Moved to nurture — next touch in 6 weeks';
        break;
      }
      case 'spoke_follow_up': {
        const due = date || rollWeekend(addDays(t0, 3));
        await db.put('tasks', newTask(contact.id, 'call', 'Follow-up call', due, 'warm_call'));
        followUp = `Follow-up call booked for ${due}`;
        break;
      }
      case 'spoke_not_now': {
        const due = date || rollWeekend(addDays(t0, 14));
        await db.put('tasks', newTask(contact.id, 'call', 'Call back — not now', due, 'warm_call'));
        followUp = `Call back scheduled for ${due}`;
        break;
      }
      case 'voicemail': {
        const pending = (await db.byIndex('tasks', 'contactId', contact.id))
          .filter((t) => t.status === 'open' && t.type === 'email' && t.templateHint === 'ce-c' && t.dueDate > t0)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
        if (pending) {
          pending.dueDate = t0;
          await db.put('tasks', pending);
          followUp = 'Email after voicemail moved to Today';
        } else if (!(await hasOpen(contact.id, 'email', t0))) {
          await db.put('tasks', newTask(contact.id, 'email', 'Email after voicemail', t0, 'ce-c'));
          followUp = 'Email after voicemail added to Today';
        }
        break;
      }
      case 'wrong_person':
        contact.notes = `${contact.notes ? contact.notes + '\n' : ''}${t0}: wrong person${notes ? ' — ' + notes : ''}`;
        break;
      default: break;
    }
    if (['no_answer', 'voicemail'].includes(outcome) && contact.status === 'active' && !(await hasOpen(contact.id, 'call'))) {
      const due = rollWeekend(addDays(t0, 2));
      await db.put('tasks', newTask(contact.id, 'call', 'Call again', due, 'warm_or_cold'));
      followUp = followUp || `Call again scheduled for ${due}`;
    }
    await db.put('contacts', contact);
    await refreshContact(contact.id);
  }
  return { activity, followUp, contact };
}

export async function setContactStatus(contact, status) {
  contact.status = status;
  if (status === 'nurture') contact.rung = 10;
  await db.put('contacts', contact);
  if (status !== 'active') await cancelOpenTasks(contact.id);
  await refreshContact(contact.id);
}
