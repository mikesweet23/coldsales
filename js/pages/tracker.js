import { db } from '../db.js';
import { state } from '../state.js';
import { h, today, addDays, mondayOf, fmtDate, fmtTime, tsToYmd, weekdayOf, dowName, download, csvEscape, diffDays, parseYmd } from '../util.js';
import { icon, emptyState } from '../ui.js';
import { TYPE_LABEL, outcomeLabel } from '../activity.js';
import { countsByDay, weekRange, totalsFor, outreachOnly, isPlannedDay, CONVERSATION_OUTCOMES } from '../stats.js';
import { sectionLabel } from '../components.js';

const refresh = () => window.dispatchEvent(new Event('outbound:refresh'));
let weekOffset = 0;
let selectedDay = '';
const WEEKS = 18;
const SERIES = [
  { k: 'calls', label: 'Calls', color: 'var(--red)' },
  { k: 'emails', label: 'Emails', color: 'var(--text)' },
  { k: 'linkedin', label: 'LinkedIn', color: 'var(--text-muted)' },
  { k: 'mushroom', label: 'Mushroom', color: 'var(--red-dark)' },
];

function level(n) { return n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4; }

function heatmap(byDay, settings, onPick, since) {
  const t0 = today();
  const start = addDays(mondayOf(t0), -(WEEKS - 1) * 7);
  const cell = 15;
  const gap = 3;
  const left = 22;
  const top = 4;
  const W = left + WEEKS * (cell + gap);
  const H = top + 7 * (cell + gap);
  const alphas = [0, 0.3, 0.55, 0.8, 1];
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="group" aria-label="Outreach activity heatmap" class="heat">`;
  [['M', 0], ['W', 2], ['F', 4]].forEach(([l, r]) => { svg += `<text x="0" y="${top + r * (cell + gap) + cell - 3}" font-size="9" fill="var(--text-muted)">${l}</text>`; });
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const day = addDays(start, w * 7 + d);
      const row = byDay.get(day);
      const n = row ? row.total : 0;
      const planned = isPlannedDay(settings, day);
      const future = day > t0;
      const called = row && row.calls > 0;
      const missed = planned && day < t0 && day >= since && !called;
      const x = left + w * (cell + gap);
      const y = top + d * (cell + gap);
      const lv = level(n);
      const fill = lv === 0 ? 'var(--surface-2)' : `rgba(227,6,19,${alphas[lv]})`;
      let stroke = 'none';
      let dash = '';
      if (planned) { stroke = 'var(--red)'; if (missed) dash = ' stroke-dasharray="3 2"'; }
      const label = `${fmtDate(day)}: ${n} ${n === 1 ? 'activity' : 'activities'}${planned ? ', planned call day' : ''}${missed ? ' (missed)' : ''}`;
      svg += `<rect data-day="${day}" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" fill="${future ? 'transparent' : fill}" stroke="${future && !planned ? 'var(--border)' : stroke}" stroke-width="1.5"${dash} ${day === t0 ? 'class="today-cell"' : ''} tabindex="0" role="button" aria-label="${label}"><title>${label}</title></rect>`;
    }
  }
  svg += '</svg>';
  const el = h('div', { class: 'heat-wrap', html: svg });
  el.addEventListener('click', (e) => { const r = e.target.closest('rect[data-day]'); if (r) onPick(r.dataset.day); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const r = e.target.closest && e.target.closest('rect[data-day]'); if (r) onPick(r.dataset.day); } });
  return el;
}

function weeklyChart(byDay, days) {
  const W = 320;
  const H = 170;
  const padL = 24;
  const padB = 22;
  const padT = 10;
  const totals = days.map((d) => (byDay.get(d) ? byDay.get(d).total : 0));
  const max = Math.max(5, ...totals);
  const bw = 28;
  const step = (W - padL) / 7;
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Activities per day this week">`;
  for (let i = 0; i <= 2; i++) {
    const v = Math.round((max / 2) * i);
    const y = H - padB - (v / max) * (H - padB - padT);
    svg += `<line x1="${padL}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-width="1"/><text x="${padL - 4}" y="${y + 3}" font-size="9" text-anchor="end" fill="var(--text-muted)">${v}</text>`;
  }
  days.forEach((d, i) => {
    const row = byDay.get(d) || { calls: 0, emails: 0, linkedin: 0, mushroom: 0, total: 0 };
    const x = padL + i * step + (step - bw) / 2;
    let y = H - padB;
    for (const s of SERIES) {
      const v = row[s.k];
      if (!v) continue;
      const hgt = (v / max) * (H - padB - padT);
      y -= hgt;
      svg += `<rect x="${x}" y="${y.toFixed(1)}" width="${bw}" height="${Math.max(1, hgt - 1).toFixed(1)}" rx="2" fill="${s.color}"><title>${s.label}: ${v}</title></rect>`;
    }
    if (row.total) svg += `<text x="${x + bw / 2}" y="${y - 3}" font-size="9" text-anchor="middle" fill="var(--text)" font-weight="700">${row.total}</text>`;
    svg += `<text x="${x + bw / 2}" y="${H - 7}" font-size="10" text-anchor="middle" fill="${d === today() ? 'var(--red)' : 'var(--text-muted)'}" font-weight="${d === today() ? 700 : 400}">${dowName(weekdayOf(d)).slice(0, 2)}</text>`;
  });
  svg += '</svg>';
  return h('div', { html: svg });
}

function outcomesChart(acts) {
  const calls = acts.filter((a) => a.type === 'call');
  const box = h('div', { class: 'funnel' });
  if (!calls.length) { box.append(h('p', { class: 'muted' }, 'Log some calls and your outcomes show here.')); return box; }
  const counts = state.content.meta.outcomes.map((o) => ({ o, n: calls.filter((a) => a.outcome === o.id).length }));
  const max = Math.max(1, ...counts.map((c) => c.n));
  for (const { o, n } of counts) {
    box.append(h('div', { class: 'f-row' },
      h('span', { class: 'f-label small' }, o.label),
      h('div', { class: 'bar f' }, h('span', { style: { width: Math.max(n ? 4 : 0, (n / max) * 100) + '%' } })),
      h('span', { class: 'f-n small' }, n)));
  }
  return box;
}

function skillsChart(acts) {
  const convo = acts.filter((a) => a.type === 'call' && Array.isArray(a.skills) && a.skills.length);
  const box = h('div', { class: 'funnel' });
  if (!convo.length) { box.append(h('p', { class: 'muted' }, 'When you log a conversation, tick the skills you used. Your habits show here.')); return box; }
  const counts = state.content.skills.map((sk) => ({ sk, n: convo.filter((a) => a.skills.includes(sk.id)).length }));
  for (const { sk, n } of counts) {
    box.append(h('div', { class: 'f-row' },
      h('span', { class: 'f-label small' }, sk.title),
      h('div', { class: 'bar f' }, h('span', { style: { width: Math.round((n / convo.length) * 100) + '%' } })),
      h('span', { class: 'f-n small' }, `${Math.round((n / convo.length) * 100)}%`)));
  }
  box.append(h('p', { class: 'muted small' }, `Based on ${convo.length} logged ${convo.length === 1 ? 'conversation' : 'conversations'}. Lowest bar = the skill to practise this week.`));
  return box;
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');

function exportCsv(acts) {
  const head = ['Date', 'Time', 'Who', 'Type', 'Outcome', 'Variant', 'Skills used', 'Notes'];
  const rows = [...acts].sort((a, b) => a.timestamp - b.timestamp).map((a) => [
    tsToYmd(a.timestamp), fmtTime(a.timestamp), a.who || '', TYPE_LABEL[a.type] || a.type, outcomeLabel(a.outcome), a.variant || '',
    (a.skills || []).join(' '), (a.notes || '').replace(/\n/g, ' '),
  ]);
  download(`outbound-activities-${today()}.csv`, [head, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n'), 'text/csv');
}

export async function render(root) {
  const acts = await db.all('activities');
  const s = state.settings;
  const byDay = countsByDay(acts);
  const t0 = today();

  root.append(h('div', { class: 'page-head' }, h('h1', null, 'Tracker'),
    h('button', { class: 'btn ghost sm', onclick: () => exportCsv(acts) }, icon('download', 16), 'CSV')));

  if (!acts.length) {
    root.append(emptyState('Nothing to track yet', 'Log your first touches from Today. The heatmap and charts fill in as you work.', h('a', { class: 'btn', href: '#/today' }, 'Go to Today')));
  }

  // Only count a planned day as "missed" once the rep has actually started using the app
  const starts = acts.map((a) => a.timestamp).filter(Boolean);
  const since = starts.length ? tsToYmd(Math.min(...starts)) : addDays(t0, 1);

  // call-day nudge
  let nudge = null;
  const plannedToday = isPlannedDay(s, t0);
  for (let i = 1; i <= 7 && !nudge; i++) {
    const d = addDays(t0, -i);
    if (d >= since && isPlannedDay(s, d) && !(byDay.get(d) && byDay.get(d).calls > 0)) nudge = `You missed your planned call day: ${fmtDate(d)}. Make today count.`;
  }
  if (plannedToday) {
    const slot = s.callDays.find((c) => c.weekday === weekdayOf(t0));
    const done = byDay.get(t0) && byDay.get(t0).calls > 0;
    root.append(h('div', { class: 'card nudge ' + (done ? 'ok' : '') }, icon('phone', 20), h('div', null, h('strong', null, done ? 'Call day: done ✓' : 'Today is a planned call day'), slot ? h('div', { class: 'small muted' }, `${slot.start}–${slot.end} power hour`) : null)));
  } else if (nudge) {
    root.append(h('div', { class: 'card nudge' }, icon('clock', 20), h('div', null, nudge)));
  }

  // heatmap
  root.append(sectionLabel('Activity'));
  const detail = h('div', { class: 'day-detail' });
  const showDay = (d) => {
    selectedDay = d;
    detail.textContent = '';
    const row = byDay.get(d);
    detail.append(h('h3', null, fmtDate(d)));
    const planned = isPlannedDay(s, d);
    if (planned) detail.append(h('p', { class: 'small muted' }, 'Planned call day'));
    const items = (acts.filter((a) => tsToYmd(a.timestamp) === d)).sort((a, b) => a.timestamp - b.timestamp);
    if (!items.length) detail.append(h('p', { class: 'muted' }, d > t0 ? 'Nothing logged yet.' : 'No activity.'));
    items.forEach((a) => {
      detail.append(h('div', { class: 'tl-item' }, h('span', { class: 'muted small' }, fmtTime(a.timestamp)),
        h('div', null, h('strong', null, TYPE_LABEL[a.type] || a.type), ' · ', outcomeLabel(a.outcome), a.who ? h('div', { class: 'muted small' }, a.who) : null)));
    });
    void row;
  };
  const heat = heatmap(byDay, s, showDay, since);
  root.append(h('div', { class: 'card' }, heat,
    h('div', { class: 'legend small muted' },
      h('span', null, 'Less'), [0, 1, 2, 3, 4].map((l) => h('i', { class: 'lg l' + l })), h('span', null, 'More'),
      h('span', { class: 'planned-key' }, h('i', { class: 'lg planned' }), 'Planned call day')),
    detail));
  showDay(selectedDay || t0);

  // weekly chart
  const days = weekRange(weekOffset);
  root.append(sectionLabel('Weekly', h('div', { class: 'row gap-s' },
    h('button', { class: 'icon-btn', 'aria-label': 'Previous week', onclick: () => { weekOffset -= 1; refresh(); } }, icon('left')),
    h('button', { class: 'icon-btn', 'aria-label': 'Next week', disabled: weekOffset >= 0, onclick: () => { weekOffset += 1; refresh(); } }, icon('right')))));
  root.append(h('div', { class: 'card' },
    h('div', { class: 'muted small' }, `${fmtDate(days[0])} – ${fmtDate(days[6])}${weekOffset === 0 ? ' (this week)' : ''}`),
    weeklyChart(byDay, days),
    h('div', { class: 'legend small' }, SERIES.map((x) => h('span', { class: 'lg-item' }, h('i', { class: 'lg', style: { background: x.color } }), x.label)))));

  // outcomes + skills
  root.append(sectionLabel('Call outcomes'));
  root.append(h('div', { class: 'card' }, outcomesChart(acts)));
  root.append(sectionLabel('Skills you use'));
  root.append(h('div', { class: 'card' }, skillsChart(acts)));

  // ratios
  const all = totalsFor(acts, acts.map((a) => tsToYmd(a.timestamp)));
  root.append(sectionLabel('Conversion'));
  root.append(h('div', { class: 'card ratios' },
    h('div', { class: 'ratio' }, h('strong', { class: 'big-num' }, all.calls), h('span', { class: 'muted small' }, 'Dials')),
    h('div', { class: 'ratio arrow' }, h('span', { class: 'pct' }, pct(all.conversations, all.calls)), icon('right', 16)),
    h('div', { class: 'ratio' }, h('strong', { class: 'big-num' }, all.conversations), h('span', { class: 'muted small' }, 'Conversations')),
    h('div', { class: 'ratio arrow' }, h('span', { class: 'pct' }, pct(all.meetings, all.conversations)), icon('right', 16)),
    h('div', { class: 'ratio' }, h('strong', { class: 'big-num red' }, all.meetings), h('span', { class: 'muted small' }, 'Meetings'))));
  root.append(h('p', { class: 'muted small tight' }, `Dial → meeting: ${pct(all.meetings, all.calls)}. Conversation = spoke, not interested or meeting booked.`));

  // this week vs last
  const thisW = totalsFor(acts, weekRange(0));
  const lastW = totalsFor(acts, weekRange(-1));
  root.append(sectionLabel('This week vs last week'));
  const table = h('div', { class: 'card compare' }, h('div', { class: 'c-row head small muted' }, h('span'), h('span', null, 'This'), h('span', null, 'Last'), h('span', null, '±')));
  for (const [k, l] of [['calls', 'Calls'], ['conversations', 'Conversations'], ['meetings', 'Meetings'], ['emails', 'Emails'], ['linkedin', 'LinkedIn'], ['mushroom', 'Mushroom']]) {
    const d = thisW[k] - lastW[k];
    table.append(h('div', { class: 'c-row' }, h('span', null, l), h('strong', null, thisW[k]), h('span', { class: 'muted' }, lastW[k]),
      h('span', { class: d > 0 ? 'up' : d < 0 ? 'down' : 'muted' }, d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : '–')));
  }
  root.append(table);
  void diffDays; void parseYmd; void CONVERSATION_OUTCOMES;
}
