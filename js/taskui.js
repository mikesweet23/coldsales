import { db } from './db.js';
import { h, today, fmtRelative, diffDays } from './util.js';
import { icon, toast, sheet } from './ui.js';
import { TASK_ICON, completeTask, skipTask, rescheduleTask, emailVariant } from './cadence.js';
import { buzz } from './util.js';

export function taskHref(task) {
  const q = `contact=${task.contactId}&task=${task.id}`;
  switch (task.type) {
    case 'call': return `#/call?${q}&mode=${/warm/.test(task.templateHint || '') || /Follow-up|back/i.test(task.label) ? 'warm' : 'auto'}`;
    case 'email': return `#/scripts/${emailVariant(task.templateHint) === 'warm' ? 'warm-email' : 'cold-email'}?${q}&hint=${encodeURIComponent(task.templateHint || '')}`;
    case 'linkedin_connect': return `#/scripts/linkedin?${q}&section=connect`;
    case 'linkedin_engage': return `#/scripts/linkedin?${q}&section=engage`;
    case 'linkedin_message': return `#/scripts/linkedin?${q}&section=message`;
    default: return `#/pipeline/${task.contactId}?task=${task.id}`;
  }
}

export function taskRow(task, contact, { onChange, showContact = true } = {}) {
  const overdue = task.status === 'open' && task.dueDate < today();
  const row = h('div', { class: 'task' + (overdue ? ' overdue' : '') + (task.status !== 'open' ? ' done' : '') });
  const main = h('a', { class: 'task-main', href: taskHref(task) },
    h('span', { class: 'task-ic' }, icon(TASK_ICON[task.type] || 'check', 20)),
    h('span', { class: 'task-body' },
      h('span', { class: 'task-title' }, task.label),
      h('span', { class: 'muted small' },
        showContact && contact ? `${contact.name}${contact.company ? ' · ' + contact.company : ''}` : '',
        overdue ? h('span', { class: 'overdue-tag' }, ` ${fmtRelative(task.dueDate)}`) : (showContact ? '' : fmtRelative(task.dueDate)))));
  row.append(main);
  if (task.status === 'open') {
    const actions = h('div', { class: 'task-actions' });
    if (task.type !== 'call') {
      actions.append(h('button', {
        class: 'icon-btn done-btn', 'aria-label': `Mark ${task.label} done`,
        onclick: async () => { await completeTask(task); buzz(); toast('Done'); onChange && onChange(); },
      }, icon('check', 22)));
    }
    actions.append(h('button', { class: 'icon-btn', 'aria-label': 'Reschedule or skip', onclick: () => taskMenu(task, onChange) }, icon('clock', 20)));
    row.append(actions);
  }
  return row;
}

function taskMenu(task, onChange) {
  sheet('Task', (close) => {
    const date = h('input', { class: 'input', type: 'date', value: task.dueDate });
    return h('div', null,
      h('p', null, task.label),
      h('label', { class: 'field' }, h('span', null, 'Reschedule to'), date),
      h('button', { class: 'btn', onclick: async () => { if (date.value) { await rescheduleTask(task, date.value); close(); toast('Rescheduled'); onChange && onChange(); } } }, 'Reschedule'),
      h('button', { class: 'btn ghost', onclick: async () => { await skipTask(task); close(); toast('Skipped'); onChange && onChange(); } }, 'Skip this task'));
  });
}

// Sticky banner on script pages when opened from a task
export async function taskBanner(taskId, scriptIds = () => []) {
  if (!taskId) return null;
  const task = await db.get('tasks', taskId);
  if (!task || task.status !== 'open') return null;
  const contact = await db.get('contacts', task.contactId);
  const bar = h('div', { class: 'task-banner' },
    h('div', null, h('strong', null, task.label), h('div', { class: 'small muted' }, contact ? `${contact.name}${contact.company ? ' · ' + contact.company : ''}` : '')),
    h('button', {
      class: 'btn sm', onclick: async () => {
        await completeTask(task, { scriptIds: scriptIds() });
        buzz();
        toast('Task done');
        bar.remove();
        location.hash = '#/today';
      },
    }, icon('check', 16), 'Mark done'));
  return bar;
}

export { diffDays };
