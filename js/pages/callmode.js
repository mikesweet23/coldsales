import { state, placeholderCtx, getProspect, setProspect } from '../state.js';
import { h } from '../util.js';
import { icon, sheet } from '../ui.js';
import { carousel, skillsPicker } from '../components.js';
import { filterItems } from '../shuffle.js';
import { logWithFeedback } from '../activity.js';
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
  const used = new Set();
  let car = null;

  const screen = h('div', { class: 'call' });
  root.append(screen);

  const close = () => { if (history.length > 1) history.back(); else location.hash = '#/today'; };
  const who = () => { const p = getProspect(); return [p.name, p.company].filter(Boolean).join(', '); };

  async function log(outcome, notes = '', skills = []) {
    await logWithFeedback({ type: 'call', outcome, who: who(), notes, scriptIds: [...used], skills, variant: mode });
    location.hash = '#/today';
  }

  function outcomeSheet(o) {
    sheet(o.label, (done) => {
      const notes = h('textarea', { class: 'input', rows: '3', placeholder: o.id === 'wrong_person' ? 'Who’s the right person? (add them to Pipedrive)' : 'Notes (optional)' });
      const picked = new Set();
      return h('div', null,
        notes,
        h('p', { class: 'muted small' }, 'Which skills did you use? (optional)'),
        skillsPicker(picked),
        h('p', { class: 'muted small' }, 'Then update Pipedrive: outcome, next step and date.'),
        h('button', { class: 'btn' + (o.id === 'meeting' ? ' success' : ''), onclick: async () => { done(); await log(o.id, notes.value, [...picked]); } }, 'Save & finish'));
    });
  }

  function draw() {
    screen.textContent = '';
    const ctx = placeholderCtx();
    const f = initFilters();
    const { main, any } = stepsFor(mode);
    const prospect = getProspect();

    screen.append(h('header', { class: 'call-top' },
      h('button', { class: 'icon-btn', 'aria-label': 'Close call mode', onclick: close }, icon('x', 24)),
      h('div', { class: 'who' }, h('strong', null, 'Call Mode'), h('span', { class: 'muted small' }, who() || 'Add who you’re calling below')),
      h('div', { class: 'seg compact' },
        ['cold', 'warm'].map((m) => h('button', { class: 'seg-btn' + (m === mode ? ' on' : ''), onclick: () => { mode = m; step = 'opener'; lastMain = 'opener'; draw(); } }, m === 'cold' ? 'Cold' : 'Warm')))));

    const name = h('input', { class: 'input', placeholder: 'First name', value: prospect.name || '', autocomplete: 'off', 'aria-label': 'Prospect name' });
    const site = h('input', { class: 'input', placeholder: 'Company / site', value: prospect.company || '', autocomplete: 'off', 'aria-label': 'Prospect company or site' });
    const save = () => { setProspect({ name: name.value.trim(), company: site.value.trim() }); draw(); };
    name.addEventListener('change', save);
    site.addEventListener('change', save);
    screen.append(h('div', { class: 'call-prospect' }, name, site));

    screen.append(h('div', { class: 'call-sub' },
      h('div', { class: 'voice-chips' },
        [{ id: '', label: 'All styles' }, ...state.content.meta.voices.filter((v) => v.id !== 'neutral')].map((v) =>
          h('button', { class: 'chip sm' + (f.voice === v.id ? ' on' : ''), onclick: () => { f.voice = v.id; draw(); } }, v.label)))));

    const chips = h('nav', { class: 'call-steps', 'aria-label': 'Call stages' });
    main.forEach((s, i) => chips.append(h('button', { class: 'step' + (s === step ? ' on' : ''), onclick: () => { step = s; lastMain = s; draw(); } },
      h('span', { class: 'n' }, i + 1), STAGE_LABEL_SHORT[s])));
    const anyLabel = { label: 'Label', brushoffs: 'Brush-off', voicemail: 'Voicemail' };
    any.forEach((s) => chips.append(h('button', { class: 'step any' + (s === step ? ' on' : ''), onclick: () => { if (main.includes(step)) lastMain = step; step = s; draw(); } }, anyLabel[s])));
    chips.append(h('button', { class: 'step end' + (step === 'outcome' ? ' on' : ''), onclick: () => { if (main.includes(step)) lastMain = step; step = 'outcome'; draw(); } }, icon('check', 14), 'Outcome'));
    screen.append(chips);
    setTimeout(() => { const on = chips.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' }); }, 0);

    const bodyEl = h('main', { class: 'call-main' });
    screen.append(bodyEl);
    const foot = h('footer', { class: 'call-actions' });
    screen.append(foot);
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
      bodyEl.append(h('h2', { class: 'stage-title' }, 'How did it go?'));
      const grid = h('div', { class: 'outcome-grid big' });
      for (const o of state.content.meta.outcomes) {
        grid.append(h('button', {
          class: 'btn outcome ' + (o.id === 'meeting' ? 'success' : 'ghost'),
          onclick: () => { if (['no_answer', 'voicemail'].includes(o.id)) log(o.id); else outcomeSheet(o); },
        }, o.label));
      }
      bodyEl.append(grid, h('p', { class: 'muted small center' }, 'Logging counts towards your targets. Then update Pipedrive.'));
      foot.append(h('button', { class: 'btn ghost', onclick: () => { step = lastMain; draw(); } }, icon('arrowLeft', 18), 'Back to call'));
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
  return () => document.body.classList.remove('call-mode');
}
