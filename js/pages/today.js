import { db } from '../db.js';
import { state } from '../state.js';
import { h, today, parseYmd, fmtDate, firstName, fmtTime, tsToYmd, pref } from '../util.js';
import { icon, toast, selectEl, confirmDialog } from '../ui.js';
import { todayCounts, computeStreak, CONVERSATION_OUTCOMES } from '../stats.js';
import { sectionLabel } from '../components.js';
import { openLogSheet } from '../logsheet.js';
import { TYPE_LABEL, TYPE_ICON, outcomeLabel, openPipedrive, deleteActivity } from '../activity.js';

const refresh = () => window.dispatchEvent(new Event('outbound:refresh'));

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

function readPower() { try { return JSON.parse(pref('power') || 'null'); } catch (e) { return null; } }

function powerCard(acts, timers) {
  const p = readPower();
  const card = h('div', { class: 'card power' });
  if (!p) {
    let minutes = 60;
    card.append(
      h('div', { class: 'row between' }, h('div', null, h('strong', null, 'Power hour'), h('div', { class: 'muted small' }, 'A focused block. Phone down, dials only.')), icon('clock', 22, 'red')),
      h('div', { class: 'row gap' },
        selectEl([30, 45, 60, 90, 120].map((m) => ({ value: m, label: `${m} min` })), 60, (v) => { minutes = Number(v); }, { 'aria-label': 'Length' }),
        h('button', { class: 'btn', onclick: () => { pref('power', JSON.stringify({ start: Date.now(), minutes })); refresh(); } }, 'Start')));
    return card;
  }
  const end = p.start + p.minutes * 60000;
  const dials = () => acts.filter((a) => a.type === 'call' && a.timestamp >= p.start);
  const clock = h('div', { class: 'power-clock', 'aria-live': 'off' });
  const stats = h('div', { class: 'muted small' });
  const tick = () => {
    const left = Math.max(0, end - Date.now());
    const m = Math.floor(left / 60000);
    const sec = Math.floor((left % 60000) / 1000);
    clock.textContent = left ? `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : 'Time!';
    const d = dials();
    stats.textContent = `${d.length} ${d.length === 1 ? 'dial' : 'dials'} · ${d.filter((a) => CONVERSATION_OUTCOMES.includes(a.outcome)).length} conversations · ${d.filter((a) => a.outcome === 'meeting').length} meetings`;
  };
  tick();
  timers.push(setInterval(tick, 1000));
  card.append(
    h('div', { class: 'row between' }, h('strong', null, 'Power hour'), h('span', { class: 'tag hot' }, 'Live')),
    clock, stats,
    h('div', { class: 'row gap' },
      h('button', { class: 'btn', onclick: () => openLogSheet({ type: 'call', onDone: refresh }) }, icon('phone', 18), 'Log call'),
      h('button', { class: 'btn ghost', onclick: () => { pref('power', null); refresh(); } }, 'End')));
  return card;
}

function recentList(acts) {
  const t0 = today();
  const recent = [...acts].filter((a) => a.type !== 'research').sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
  const card = h('div', { class: 'card list' });
  if (!recent.length) {
    card.append(h('p', { class: 'muted pad' }, 'Nothing logged yet. Tap Call, Email, LinkedIn or Mushroom above as you work.'));
    return card;
  }
  for (const a of recent) {
    const day = tsToYmd(a.timestamp);
    card.append(h('div', { class: 'task' },
      h('div', { class: 'task-main' },
        h('span', { class: 'task-ic' }, icon(TYPE_ICON[a.type] || 'check', 20)),
        h('span', { class: 'task-body' },
          h('span', { class: 'task-title' }, `${TYPE_LABEL[a.type] || a.type} · ${outcomeLabel(a.outcome)}`),
          h('span', { class: 'muted small' }, `${a.who ? a.who + ' · ' : ''}${day === t0 ? 'Today' : fmtDate(day)} ${fmtTime(a.timestamp)}`))),
      h('div', { class: 'task-actions' },
        h('button', {
          class: 'icon-btn', 'aria-label': 'Delete this entry', onclick: async () => {
            if (await confirmDialog('Remove this entry from your log?', 'Remove', true)) { await deleteActivity(a.id); toast('Removed'); refresh(); }
          },
        }, icon('trash', 18)))));
  }
  return card;
}

export async function render(root) {
  const acts = await db.all('activities');
  const counts = todayCounts(acts);
  const s = state.settings;
  const tg = s.targets;
  const t0 = today();
  const timers = [];
  const sumTarget = tg.calls + tg.emails + tg.linkedin + tg.mushroom;
  const sumDone = Math.min(counts.calls, tg.calls) + Math.min(counts.emails, tg.emails) + Math.min(counts.linkedin, tg.linkedin) + Math.min(counts.mushroom, tg.mushroom);
  const streak = computeStreak(acts);
  const nm = firstName(s.repName);

  root.append(h('div', { class: 'page-head col' },
    h('h1', null, `${greeting()}${nm ? ', ' + nm : ''}`),
    h('p', { class: 'muted' }, `${fmtDate(t0)} · ${new Date().getFullYear()}`)));

  root.append(h('div', { class: 'card pipedrive' },
    h('div', { class: 'row gap' }, icon('refresh', 22, 'red'), h('div', null, h('strong', null, state.content.pipedrive.reminder), h('div', { class: 'muted small' }, 'This app tracks your activity. Pipedrive is the record of every prospect.'))),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn sm', onclick: openPipedrive }, icon('external', 16), 'Open Pipedrive'),
      h('a', { class: 'btn ghost sm', href: '#/learn/pipedrive' }, 'Checklist'))));

  const bars = h('div', { class: 'target-bars' });
  for (const [k, label] of [['calls', 'Calls'], ['emails', 'Emails'], ['linkedin', 'LinkedIn'], ['mushroom', 'Mushroom']]) {
    const pct = tg[k] ? Math.min(100, Math.round((counts[k] / tg[k]) * 100)) : 0;
    bars.append(h('div', { class: 'tbar' },
      h('div', { class: 'row between small' }, h('span', null, label), h('span', { class: 'muted' }, `${counts[k]}/${tg[k]}`)),
      h('div', { class: 'bar' }, h('span', { style: { width: pct + '%' } }))));
  }
  root.append(h('div', { class: 'card hero' }, ring(sumDone, sumTarget), bars));
  root.append(h('div', { class: 'row gap stat-row' },
    h('div', { class: 'card stat' }, icon('flame', 22, 'red'), h('div', null, h('strong', { class: 'big-num' }, streak), h('div', { class: 'muted small' }, 'day streak'))),
    h('div', { class: 'card stat' }, icon('target', 22, 'red'), h('div', null, h('strong', { class: 'big-num' }, counts.total), h('div', { class: 'muted small' }, 'touches today')))));

  root.append(sectionLabel('Log a touch'));
  root.append(h('div', { class: 'quick4' },
    [['call', 'phone', 'Call'], ['email', 'mail', 'Email'], ['linkedin_comment', 'linkedin', 'LinkedIn'], ['mushroom', 'mushroom', 'Mushroom']].map(([type, ic, label]) =>
      h('button', { class: 'btn ghost tile', onclick: () => openLogSheet({ type, onDone: refresh }) }, icon(ic, 22, 'red'), label))));
  root.append(h('div', { class: 'quick two' },
    h('a', { class: 'btn', href: '#/call' }, icon('play', 18), 'Call Mode'),
    h('a', { class: 'btn ghost', href: '#/scripts/build' }, icon('shuffle', 18), 'Build me a call')));

  root.append(sectionLabel('Power hour'));
  root.append(powerCard(acts, timers));

  root.append(sectionLabel('Recent activity'));
  root.append(recentList(acts));

  const doy = Math.floor((parseYmd(t0) - new Date(parseYmd(t0).getFullYear(), 0, 0)) / 864e5);
  const skill = state.content.skills[doy % state.content.skills.length];
  const line = skill.examples[doy % skill.examples.length];
  root.append(sectionLabel('Skill of the day'));
  root.append(h('a', { class: 'card skill-card', href: `#/learn/skill/${skill.id}` },
    h('div', { class: 'tag' }, `Skill ${skill.num}`),
    h('h3', null, skill.title),
    h('p', { class: 'quote' }, `“${line}”`),
    h('span', { class: 'muted small' }, 'Learn more', icon('right', 14))));
  return () => timers.forEach(clearInterval);
}
