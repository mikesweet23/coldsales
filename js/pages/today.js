import { db } from '../db.js';
import { state } from '../state.js';
import { h, today, parseYmd, fmtDate, firstName, buzz, diffDays } from '../util.js';
import { icon, sheet, toast, selectEl, emptyState } from '../ui.js';
import { TASK_GROUPS, logCallOutcome } from '../cadence.js';
import { todayCounts, computeStreak } from '../stats.js';
import { taskRow } from '../taskui.js';
import { sectionLabel } from '../components.js';

function greeting() {
  const hr = new Date().getHours();
  return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
}

function ring(done, target) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = target ? Math.min(1, done / target) : 0;
  const svg = `<svg viewBox="0 0 100 100" width="104" height="104" role="img" aria-label="${done} of ${target} daily targets">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="10"/>
    ${pct > 0 ? `<circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--red)" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/>` : ''}
    <text x="50" y="48" text-anchor="middle" font-size="22" font-weight="800" fill="var(--text)">${done}</text>
    <text x="50" y="64" text-anchor="middle" font-size="9" fill="var(--text-muted)">of ${target}</text></svg>`;
  return h('div', { class: 'ring', html: svg });
}

export async function openLogCall(onDone) {
  const contacts = (await db.all('contacts')).sort((a, b) => a.name.localeCompare(b.name));
  sheet('Log a call', (close) => {
    const sel = selectEl([{ value: '', label: 'No contact' }, ...contacts.map((c) => ({ value: c.id, label: `${c.name}${c.company ? ' — ' + c.company : ''}` }))], '');
    const notes = h('textarea', { class: 'input', rows: '2', placeholder: 'Notes (optional)' });
    const grid = h('div', { class: 'outcome-grid' });
    for (const o of state.content.meta.outcomes.filter((x) => x.id !== 'wrong_person')) {
      grid.append(h('button', {
        class: 'btn ghost outcome' + (o.id === 'meeting' ? ' good' : ''), onclick: async () => {
          const res = await logCallOutcome({ contactId: sel.value, outcome: o.id, notes: notes.value });
          buzz();
          close();
          toast(res.followUp ? `Logged · ${res.followUp}` : 'Call logged');
          onDone && onDone();
        },
      }, o.label));
    }
    return h('div', null,
      h('label', { class: 'field' }, h('span', null, 'Who did you call?'), sel),
      notes,
      h('p', { class: 'muted small' }, 'Tap the outcome to log it.'),
      grid);
  });
}

export async function render(root) {
  const [tasks, contacts, acts] = await Promise.all([db.all('tasks'), db.all('contacts'), db.all('activities')]);
  const cmap = new Map(contacts.map((c) => [c.id, c]));
  const t0 = today();
  const due = tasks
    .filter((t) => t.status === 'open' && t.dueDate <= t0 && cmap.has(t.contactId))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const counts = todayCounts(acts);
  const s = state.settings;
  const tg = s.targets;
  const sumTarget = tg.calls + tg.emails + tg.linkedin + tg.mushroom;
  const sumDone = Math.min(counts.calls, tg.calls) + Math.min(counts.emails, tg.emails) + Math.min(counts.linkedin, tg.linkedin) + Math.min(counts.mushroom, tg.mushroom);
  const streak = computeStreak(acts);
  const refresh = () => window.dispatchEvent(new Event('outbound:refresh'));

  const nm = firstName(s.repName);
  root.append(
    h('div', { class: 'page-head col' },
      h('h1', null, `${greeting()}${nm ? ', ' + nm : ''}`),
      h('p', { class: 'muted' }, fmtDate(t0).replace(/^\w+/, (d) => d) + ' · ' + new Date().getFullYear())));

  // Targets + streak
  const bars = h('div', { class: 'target-bars' });
  for (const [k, label] of [['calls', 'Calls'], ['emails', 'Emails'], ['linkedin', 'LinkedIn'], ['mushroom', 'Mushroom']]) {
    const pct = tg[k] ? Math.min(100, Math.round((counts[k] / tg[k]) * 100)) : 0;
    bars.append(h('div', { class: 'tbar' },
      h('div', { class: 'row between small' }, h('span', null, label), h('span', { class: 'muted' }, `${counts[k]}/${tg[k]}`)),
      h('div', { class: 'bar' }, h('span', { style: { width: pct + '%' } }))));
  }
  root.append(h('div', { class: 'card hero' }, ring(sumDone, sumTarget), bars));
  root.append(h('div', { class: 'row gap stat-row' },
    h('div', { class: 'card stat' }, icon('flame', 22, 'red'), h('div', null, h('strong', { class: 'big-num' }, streak), h('div', { class: 'muted small' }, streak === 1 ? 'day streak' : 'day streak'))),
    h('div', { class: 'card stat' }, icon('target', 22, 'red'), h('div', null, h('strong', { class: 'big-num' }, counts.total), h('div', { class: 'muted small' }, 'touches today')))));

  // Quick buttons
  root.append(h('div', { class: 'quick' },
    h('button', { class: 'btn', onclick: () => openLogCall(refresh) }, icon('phone', 18), 'Log a call'),
    h('a', { class: 'btn ghost', href: '#/scripts/build' }, icon('shuffle', 18), 'Build me a call'),
    h('a', { class: 'btn ghost', href: '#/pipeline/new' }, icon('plus', 18), 'Add contact')));

  // Tasks
  const overdueCount = due.filter((t) => t.dueDate < t0).length;
  root.append(sectionLabel(`Today’s tasks${due.length ? ' · ' + due.length : ''}`, overdueCount ? h('span', { class: 'overdue-tag' }, `${overdueCount} overdue`) : null));
  if (!due.length) {
    root.append(contacts.length
      ? emptyState('All clear', 'No tasks due. Add more contacts or check the Pipeline for what’s coming up.', h('a', { class: 'btn ghost', href: '#/pipeline' }, 'Open pipeline'))
      : emptyState('Add your first contact', 'Adding a contact builds their 21-day outreach cadence and fills this list.', h('a', { class: 'btn', href: '#/pipeline/new' }, icon('plus', 18), 'Add contact')));
  }
  for (const g of TASK_GROUPS) {
    const list = due.filter((t) => g.types.includes(t.type));
    if (!list.length) continue;
    root.append(h('h3', { class: 'group-title' }, `${g.label} · ${list.length}`));
    const card = h('div', { class: 'card list' });
    for (const t of list) card.append(taskRow(t, cmap.get(t.contactId), { onChange: refresh }));
    root.append(card);
  }

  // Skill of the day
  const doy = Math.floor((parseYmd(t0) - new Date(parseYmd(t0).getFullYear(), 0, 0)) / 864e5);
  const skill = state.content.skills[doy % state.content.skills.length];
  const line = skill.examples[doy % skill.examples.length];
  root.append(sectionLabel('Skill of the day'));
  root.append(h('a', { class: 'card skill-card', href: `#/learn/skill/${skill.id}` },
    h('div', { class: 'tag' }, `Skill ${skill.num}`),
    h('h3', null, skill.title),
    h('p', { class: 'quote' }, `“${line}”`),
    h('span', { class: 'muted small' }, 'Learn more', icon('right', 14))));
  void diffDays;
}
