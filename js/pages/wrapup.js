import { db } from '../db.js';
import { state } from '../state.js';
import { h, tsToYmd, today, fmtDate, fmtTime } from '../util.js';
import { icon, toast, confirmDialog, segmented } from '../ui.js';
import { copyText } from '../components.js';
import { needsEntry, setEntered, deleteActivity, entryText, openPipedrive, TYPE_LABEL, TYPE_ICON, outcomeLabel } from '../activity.js';

const refresh = () => window.dispatchEvent(new Event('outbound:refresh'));
let view = 'todo';

export async function render(root) {
  const all = (await db.all('activities')).filter((a) => a.type !== 'research').sort((a, b) => a.timestamp - b.timestamp);
  const todo = all.filter(needsEntry);
  const done = all.filter((a) => !needsEntry(a)).reverse();
  const rows = view === 'todo' ? todo : done;

  root.append(h('div', { class: 'page-head' },
    h('a', { class: 'icon-btn', href: '#/today', 'aria-label': 'Back' }, icon('arrowLeft')),
    h('h1', null, 'Pipedrive wrap-up')));
  root.append(h('p', { class: 'muted tight' }, 'Everything you logged, in order. Copy each line into Pipedrive, tick it off, then you’re done. No admin while you’re dialling.'));

  root.append(h('div', { class: 'card stat-wrap' },
    h('div', { class: 'row between' }, h('div', null, h('strong', { class: 'big-num' }, todo.length), h('div', { class: 'muted small' }, todo.length === 1 ? 'touch to enter' : 'touches to enter')),
      h('button', { class: 'btn sm', onclick: openPipedrive }, icon('external', 16), 'Open Pipedrive')),
    todo.length ? h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn ghost sm', onclick: () => copyText(todo.map(entryText).join('\n')) }, icon('copy', 16), 'Copy all'),
      h('button', {
        class: 'btn ghost sm', onclick: async () => {
          if (await confirmDialog(`Mark all ${todo.length} as entered in Pipedrive?`, 'Mark all entered')) {
            for (const a of todo) await setEntered(a, true);
            toast('All entered. Nice work.');
            refresh();
          }
        },
      }, icon('check', 16), 'Mark all entered')) : null));

  root.append(segmented([{ value: 'todo', label: `To enter (${todo.length})` }, { value: 'done', label: `Entered (${done.length})` }], view, (v) => { view = v; refresh(); }));

  if (!rows.length) {
    root.append(h('div', { class: 'empty' }, h('h3', null, view === 'todo' ? 'Nothing to enter' : 'Nothing entered yet'),
      h('p', { class: 'muted' }, view === 'todo' ? 'Log touches from Today or Call Mode and they appear here.' : 'Tick items off in the To enter list.')));
  }

  let lastDay = '';
  for (const a of rows) {
    const day = tsToYmd(a.timestamp);
    if (day !== lastDay) {
      lastDay = day;
      root.append(h('h3', { class: 'group-title' }, day === today() ? 'Today' : fmtDate(day)));
    }
    const entered = !needsEntry(a);
    root.append(h('div', { class: 'card wrap-row' + (entered ? ' entered' : '') },
      h('button', {
        class: 'tick' + (entered ? ' on' : ''), 'aria-label': entered ? 'Mark as not entered' : 'Mark as entered', 'aria-pressed': String(entered),
        onclick: async () => { await setEntered(a, !entered); refresh(); },
      }, entered ? icon('check', 22) : null),
      h('div', { class: 'wrap-body' },
        h('div', { class: 'row gap-s wrap' }, icon(TYPE_ICON[a.type] || 'check', 16, 'red'), h('strong', null, `${TYPE_LABEL[a.type] || a.type} · ${outcomeLabel(a.outcome)}`), h('span', { class: 'muted small' }, fmtTime(a.timestamp))),
        a.who ? h('div', null, a.who) : h('div', { class: 'muted small' }, 'No name added'),
        a.notes ? h('div', { class: 'small muted' }, a.notes) : null),
      h('div', { class: 'wrap-actions' },
        h('button', { class: 'icon-btn', 'aria-label': 'Copy this entry', onclick: () => copyText(entryText(a)) }, icon('copy', 20)),
        h('button', {
          class: 'icon-btn', 'aria-label': 'Delete this entry', onclick: async () => {
            if (await confirmDialog('Remove this entry from your log? It will also leave your tracker.', 'Remove', true)) { await deleteActivity(a.id); toast('Removed'); refresh(); }
          },
        }, icon('trash', 18)))));
  }

  root.append(h('div', { class: 'card' }, h('strong', null, 'For each one in Pipedrive'),
    h('ul', { class: 'bullets' }, state.content.pipedrive.checklist.map((c) => h('li', null, c)))));
}
