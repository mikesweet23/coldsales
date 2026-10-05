import { state, placeholderCtx, getProspect } from '../state.js';
import { h } from '../util.js';
import { icon } from '../ui.js';
import { carousel, skillsPicker, prospectCard } from '../components.js';
import { filterItems } from '../shuffle.js';
import { logWithFeedback } from '../activity.js';
import { readPower, pausePower, resumePower, resetPower, remainingMs, fmtClock } from '../power.js';
import { initFilters } from './scripts.js';

const STAGE_LABEL_SHORT = { opener: 'Opener', contract: 'Contract', reason: 'Reason', situation: 'Situation', problem: 'Problem', consequence: 'Impact', solution: 'Vision', qualify: 'Decision', close: 'Close', bridge: 'Bridge' };

function stepsFor(mode) {
  const main = mode === 'warm'
    ? ['opener', 'bridge', 'situation', 'problem', 'consequence', 'solution', 'qualify', 'close']
    : ['opener', 'contract', 'reason', 'situation', 'problem', 'consequence', 'solution', 'qualify', 'close'];
  return { main, any: ['label', 'brushoffs', 'voicemail'] };
}

export async function render(root, { query }) {
  document.body.classList.add('call-mode');
  let mode = query.mode === 'warm' ? 'warm' : 'cold';
  let step = 'opener';
  let lastMain = 'opener';
  let objIdx = 0;
  let sessionCount = 0;
  let noteText = '';
  const used = new Set();
  const picked = new Set();
  let car = null;
  let powerTimer = null;

  const screen = h('div', { class: 'call' });
  root.append(screen);
  const headerBox = h('div');
  const subBox = h('div');
  const stepsBox = h('div');
  const bodyBox = h('div', { class: 'call-body' });
  const footBox = h('div');
  // the prospect inputs are built once so typing is never interrupted by a redraw
  const prospectBox = prospectCard(() => { paintHeader(); paintBody(); }, { compact: true });
  screen.append(headerBox, prospectBox, subBox, stepsBox, bodyBox, footBox);

  const close = () => { if (history.length > 1) history.back(); else location.hash = '#/today'; };
  const who = () => { const p = getProspect(); return [p.name, p.company].filter(Boolean).join(', '); };

  // One tap logs the call, then straight back to a fresh opener for the next dial.
  async function log(outcome) {
    await logWithFeedback({ type: 'call', outcome, who: who(), notes: noteText, scriptIds: [...used], skills: [...picked], variant: mode });
    sessionCount += 1;
    used.clear();
    picked.clear();
    noteText = '';
    prospectBox.clearFields();
    step = 'opener';
    lastMain = 'opener';
    draw();
  }

  function powerChip() {
    if (powerTimer) { clearInterval(powerTimer); powerTimer = null; }
    if (!readPower()) return null;
    const clock = h('span', { class: 'power-mini-clock' });
    const toggle = h('button', { class: 'chip sm', 'aria-label': 'Pause or resume timer' });
    const paint = () => {
      const p = readPower();
      if (!p) { clock.textContent = ''; return; }
      const left = remainingMs(p);
      clock.textContent = left === 0 ? 'Time!' : fmtClock(left);
      toggle.textContent = p.running ? 'Pause' : (p.startedAt ? 'Resume' : 'Start');
    };
    toggle.addEventListener('click', () => { const p = readPower(); if (p && p.running) pausePower(); else resumePower(); paint(); });
    const reset = h('button', { class: 'chip sm', 'aria-label': 'Reset timer', onclick: () => { resetPower(); paint(); } }, 'Reset');
    paint();
    powerTimer = setInterval(paint, 500);
    return h('div', { class: 'power-mini' }, icon('clock', 16, 'red'), clock, toggle, reset);
  }

  function paintHeader() {
    headerBox.textContent = '';
    headerBox.append(h('header', { class: 'call-top' },
      h('button', { class: 'icon-btn', 'aria-label': 'Close call mode', onclick: close }, icon('x', 24)),
      h('div', { class: 'who' }, h('strong', null, 'Call Mode'), h('span', { class: 'muted small' }, sessionCount ? `${sessionCount} logged this session` : (who() || 'Add who you’re calling below'))),
      h('div', { class: 'seg compact' },
        ['cold', 'warm'].map((m) => h('button', { class: 'seg-btn' + (m === mode ? ' on' : ''), onclick: () => { mode = m; step = 'opener'; lastMain = 'opener'; draw(); } }, m === 'cold' ? 'Cold' : 'Warm')))));
  }

  function draw() {
    paintHeader();
    const f = initFilters();
    const { main, any } = stepsFor(mode);
    const pc = powerChip();
    subBox.textContent = '';
    subBox.append(h('div', { class: 'call-sub' }, pc,
      step === 'outcome' ? null : h('div', { class: 'voice-chips' },
        [{ id: '', label: 'All styles' }, ...state.content.meta.voices.filter((v) => v.id !== 'neutral')].map((v) =>
          h('button', { class: 'chip sm' + (f.voice === v.id ? ' on' : ''), onclick: () => { f.voice = v.id; draw(); } }, v.label)))));

    const chips = h('nav', { class: 'call-steps', 'aria-label': 'Call stages' });
    main.forEach((s, i) => chips.append(h('button', { class: 'step' + (s === step ? ' on' : ''), onclick: () => { step = s; lastMain = s; draw(); } },
      h('span', { class: 'n' }, i + 1), STAGE_LABEL_SHORT[s])));
    const anyLabel = { label: 'Label', brushoffs: 'Brush-off', voicemail: 'Voicemail' };
    any.forEach((s) => chips.append(h('button', { class: 'step any' + (s === step ? ' on' : ''), onclick: () => { if (main.includes(step)) lastMain = step; step = s; draw(); } }, anyLabel[s])));
    chips.append(h('button', { class: 'step end' + (step === 'outcome' ? ' on' : ''), onclick: () => { if (main.includes(step)) lastMain = step; step = 'outcome'; draw(); } }, icon('check', 14), 'Outcome'));
    stepsBox.textContent = '';
    stepsBox.append(chips);
    setTimeout(() => { const on = chips.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' }); }, 0);
    paintBody();
  }

  function paintBody() {
    const ctx = placeholderCtx();
    const f = initFilters();
    const { main, any } = stepsFor(mode);
    const bodyEl = h('main', { class: 'call-main' });
    bodyBox.textContent = '';
    bodyBox.append(bodyEl);
    const foot = h('footer', { class: 'call-actions' });
    footBox.textContent = '';
    footBox.append(foot);
    car = null;

    const stageInfo = (mode === 'warm' ? state.content.warmStages : state.content.stages).find((s) => s.id === step);
    const next = () => {
      if (any.includes(step)) { step = lastMain; draw(); return; }
      const i = main.indexOf(step);
      lastMain = main[i + 1] || step;
      step = main[i + 1] || 'outcome';
      draw();
    };
    const nextLabel = any.includes(step) ? 'Back to call' : (main.indexOf(step) === main.length - 1 ? 'Outcome' : 'Next stage');

    if (step === 'outcome') {
      const notes = h('input', { class: 'input', type: 'text', placeholder: 'Quick note for Pipedrive (optional)', value: noteText, autocomplete: 'off' });
      notes.addEventListener('input', () => { noteText = notes.value; });
      bodyEl.append(h('h2', { class: 'stage-title' }, 'How did it go?'), notes, h('p', { class: 'muted small tight' }, 'Skills you used (optional)'), skillsPicker(picked));
      const grid = h('div', { class: 'outcome-grid big' });
      for (const o of state.content.meta.outcomes) {
        grid.append(h('button', { class: 'btn outcome ' + (o.id === 'meeting' ? 'success' : 'ghost'), onclick: () => log(o.id) }, o.label));
      }
      bodyEl.append(grid, h('p', { class: 'muted small center' }, 'Tap an outcome. It logs and gets you ready for the next call.'));
      foot.append(
        h('button', { class: 'btn ghost', onclick: () => { step = lastMain; draw(); } }, icon('arrowLeft', 18), 'Back'),
        h('a', { class: 'btn', href: '#/wrapup' }, icon('check', 18), 'Finish & wrap-up'));
      return;
    }

    let items;
    if (step === 'brushoffs') {
      const chipsRow = h('div', { class: 'obj-chips' });
      state.content.brushoffs.forEach((b, i) => chipsRow.append(h('button', { class: 'chip' + (i === objIdx ? ' on' : ''), onclick: () => { objIdx = i; draw(); } }, b.objection)));
      bodyEl.append(h('h2', { class: 'stage-title' }, 'Brush-offs'), h('p', { class: 'muted' }, 'Respond, don’t fight. Agree, label, ask one calm question.'), chipsRow, state.content.brushoffs[objIdx].delivery ? h('p', { class: 'delivery' }, state.content.brushoffs[objIdx].delivery) : null);
      items = filterItems(state.content.brushoffs[objIdx].responses.map((r) => ({ ...r, personas: [], themes: [] })), f);
    } else if (step === 'voicemail') {
      bodyEl.append(h('h2', { class: 'stage-title' }, 'Voicemail'), h('p', { class: 'muted' }, 'Under 20 seconds. Say your number slowly.'), h('p', { class: 'delivery' }, 'Warm and unhurried. Smile. Slow down on the number.'));
      items = filterItems(state.content.byCategory('voicemail'), f);
    } else if (step === 'label') {
      bodyEl.append(h('h2', { class: 'stage-title' }, 'Name the feeling'), h('p', { class: 'muted' }, 'Use any time they sound sceptical, rushed or fed up.'), h('p', { class: 'delivery' }, state.content.stages.find((x) => x.id === 'label').delivery));
      items = filterItems(state.content.byCategory('cold_call', 'label'), f);
    } else {
      const st = stageInfo || { label: step, hint: '' };
      const cat = st.reuse || (mode === 'warm' ? 'warm_call' : 'cold_call');
      bodyEl.append(h('h2', { class: 'stage-title' }, st.label), h('p', { class: 'muted' }, st.hint), st.delivery ? h('p', { class: 'delivery' }, st.delivery) : null);
      items = filterItems(state.content.byCategory(cat, step), f);
    }
    car = carousel({ key: `call:${mode}:${step}:${step === 'brushoffs' ? objIdx : ''}`, items, ctx, big: true, onUsed: (id) => used.add(id) });
    bodyEl.append(car);
    if (step === 'opener' || step === 'close') {
      bodyEl.append(h('p', { class: 'muted small center' }, 'Gatekeeper, referral and recovery lines are in Scripts → Gatekeeper and Brush-offs.'));
    }
    foot.append(
      h('button', { class: 'btn ghost', onclick: () => car && car.shuffle && car.shuffle() }, icon('shuffle', 20), 'Shuffle'),
      h('button', { class: 'btn', onclick: next }, nextLabel, icon('right', 20)));
  }

  draw();
  return () => { document.body.classList.remove('call-mode'); if (powerTimer) clearInterval(powerTimer); };
}
