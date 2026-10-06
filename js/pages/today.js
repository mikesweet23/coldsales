import { db } from '../db.js';
import { state } from '../state.js';
import { h, today, parseYmd, fmtDate, firstName } from '../util.js';
import { icon, selectEl } from '../ui.js';
import { todayCounts, computeStreak, CONVERSATION_OUTCOMES } from '../stats.js';
import { sectionLabel } from '../components.js';
import { openLogSheet } from '../logsheet.js';
import { openPipedrive, needsEntry } from '../activity.js';
import { readPower, startPower, pausePower, resumePower, resetPower, endPower, remainingMs, fmtClock, watchPower } from '../power.js';

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

function powerCard(acts, timers) {
  const card = h('div', { class: 'card power' });
  let p = readPower();
  if (!p) {
    let minutes = 60;
    card.append(
      h('div', { class: 'row between' }, h('div', null, h('strong', null, 'Power hour'), h('div', { class: 'muted small' }, 'A focused block. Phone down, dials only. Log as you go, enter in Pipedrive after.')), icon('clock', 22, 'red')),
      h('div', { class: 'row gap' },
        selectEl([30, 45, 60, 90, 120].map((m) => ({ value: m, label: `${m} min` })), 60, (v) => { minutes = Number(v); }, { 'aria-label': 'Length' }),
        h('button', { class: 'btn', onclick: () => { startPower(minutes); refresh(); } }, 'Start')));
    return card;
  }
  const clock = h('div', { class: 'power-clock', 'aria-live': 'off' });
  const stats = h('div', { class: 'muted small' });
  const status = h('span', { class: 'tag' });
  const toggle = h('button', { class: 'btn' });
  toggle.addEventListener('click', () => {
    const cur = readPower();
    if (cur && cur.running) pausePower(); else resumePower();
    refresh();
  });
  card.append(
    h('div', { class: 'row between' }, h('strong', null, 'Power hour'), status),
    clock, stats,
    h('div', { class: 'row gap wrap' },
      toggle,
      h('button', { class: 'btn ghost', onclick: () => { resetPower(); refresh(); } }, icon('refresh', 18), 'Reset')),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn ghost', onclick: () => openLogSheet({ type: 'call', onDone: refresh }) }, icon('phone', 18), 'Log call'),
      h('button', { class: 'btn ghost', onclick: () => { endPower(); location.hash = '#/wrapup'; } }, 'End & wrap up')));
  watchPower((cur, left) => {
    if (!cur) return;
    clock.textContent = fmtClock(left);
    const finished = left === 0;
    status.textContent = finished ? 'Time' : cur.running ? 'Live' : 'Paused';
    status.className = 'tag' + (cur.running && !finished ? ' hot' : '');
    toggle.textContent = cur.running ? 'Pause' : (cur.startedAt ? 'Resume' : 'Start');
    toggle.className = 'btn' + (finished ? ' hidden' : '');
    const d = cur.startedAt ? acts.filter((a) => a.type === 'call' && a.timestamp >= cur.startedAt) : [];
    stats.textContent = `${d.length} ${d.length === 1 ? 'dial' : 'dials'} · ${d.filter((a) => CONVERSATION_OUTCOMES.includes(a.outcome)).length} conversations · ${d.filter((a) => a.outcome === 'meeting').length} meetings`;
  }, timers);
  p = null;
  return card;
}

export async function render(root) {
  const acts = await db.all('activities');
  const counts = todayCounts(acts);
  const s = state.settings;
  const tg = s.targets;
  const t0 = today();
  const timers = [];
  const toEnter = acts.filter(needsEntry).length;
  const sumTarget = tg.calls + tg.emails + tg.linkedin + tg.mushroom;
  const sumDone = Math.min(counts.calls, tg.calls) + Math.min(counts.emails, tg.emails) + Math.min(counts.linkedin, tg.linkedin) + Math.min(counts.mushroom, tg.mushroom);
  const streak = computeStreak(acts);
  const nm = firstName(s.repName);

  root.append(h('div', { class: 'page-head col' },
    h('h1', null, `${greeting()}${nm ? ', ' + nm : ''}`),
    h('p', { class: 'muted' }, `${fmtDate(t0)} · ${new Date().getFullYear()}`)));

  root.append(h('div', { class: 'card pipedrive' },
    h('div', { class: 'row gap' }, icon('refresh', 22, 'red'), h('div', null,
      h('strong', null, toEnter ? `${toEnter} to enter in Pipedrive` : 'Pipedrive is up to date'),
      h('div', { class: 'muted small' }, 'Log quickly here as you work. After your block, use the wrap-up sheet to update Pipedrive in one go. ' + state.content.pipedrive.reminder))),
    h('div', { class: 'row gap wrap' },
      h('a', { class: 'btn sm', href: '#/wrapup' }, icon('check', 16), toEnter ? 'Open wrap-up sheet' : 'Wrap-up sheet'),
      h('button', { class: 'btn ghost sm', onclick: openPipedrive }, icon('external', 16), 'Open Pipedrive'))));

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

  root.append(h('a', { class: 'card nav-card', href: '#/learn/howto' }, h('div', null, h('strong', null, 'New here? How to use this app'), h('div', { class: 'muted small' }, '5 simple steps')), icon('right', 18)));

  root.append(sectionLabel('Power hour'));
  root.append(powerCard(acts, timers));

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
