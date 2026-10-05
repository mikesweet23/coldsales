// Activity log: the only thing the app records. Pipedrive remains the CRM.
import { db } from './db.js';
import { state } from './state.js';
import { uid, buzz } from './util.js';
import { toast } from './ui.js';
import { todayCounts } from './stats.js';

export const ACTIVITY_TYPES = [
  { id: 'call', label: 'Call', icon: 'phone', group: 'calls' },
  { id: 'email', label: 'Email', icon: 'mail', group: 'emails' },
  { id: 'linkedin_connect', label: 'LinkedIn connect', icon: 'linkedin', group: 'linkedin' },
  { id: 'linkedin_comment', label: 'LinkedIn comment', icon: 'linkedin', group: 'linkedin' },
  { id: 'linkedin_message', label: 'LinkedIn message', icon: 'linkedin', group: 'linkedin' },
  { id: 'linkedin_post', label: 'LinkedIn post', icon: 'linkedin', group: 'linkedin' },
  { id: 'mushroom', label: 'Mushroom', icon: 'mushroom', group: 'mushroom' },
];
export const TYPE_LABEL = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.id, t.label]));
TYPE_LABEL.linkedin_engage = 'LinkedIn engage';
TYPE_LABEL.research = 'Research';
export const TYPE_ICON = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.id, t.icon]));
TYPE_ICON.linkedin_engage = 'linkedin';
TYPE_ICON.research = 'research';

export function outcomeLabel(o) {
  const f = state.content.meta.outcomes.find((x) => x.id === o);
  return f ? f.label : o === 'done' ? 'Done' : o;
}

export function pipedriveUrl() { return (state.settings.pipedriveUrl || '').trim() || 'https://app.pipedrive.com'; }
export function openPipedrive() { window.open(pipedriveUrl(), '_blank', 'noopener'); }

export async function logActivity({ type, outcome = 'done', who = '', notes = '', scriptIds = [], skills = [], variant = '', timestamp }) {
  const activity = {
    id: uid(), contactId: null, type, outcome, who: who.trim(), notes: notes.trim(), scriptIdsUsed: scriptIds, skills,
    variant, timestamp: timestamp || Date.now(),
  };
  await db.put('activities', activity);
  return activity;
}

export async function deleteActivity(id) { await db.del('activities', id); }

// Log and give feedback: target-hit celebration plus the Pipedrive reminder.
export async function logWithFeedback(opts, { remind = true } = {}) {
  const before = todayCounts(await db.all('activities'));
  const activity = await logActivity(opts);
  const after = todayCounts(await db.all('activities'));
  buzz(30);
  const t = state.settings.targets;
  const group = (ACTIVITY_TYPES.find((x) => x.id === opts.type) || {}).group;
  const hit = group && t[group] && before[group] < t[group] && after[group] >= t[group];
  const total = Object.keys(t).every((k) => !t[k] || after[k] >= t[k]);
  const msg = hit ? `Target hit: ${t[group]} ${group}!` : 'Logged';
  if (remind) toast(`${msg} Now update Pipedrive.`, { action: 'Open Pipedrive', onAction: openPipedrive, duration: 5000 });
  else toast(msg);
  if (total && hit) setTimeout(() => toast('All daily targets hit. Nice work.', { duration: 4000 }), 600);
  return activity;
}
