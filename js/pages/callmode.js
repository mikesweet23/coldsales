import { db } from '../db.js';
import { state, placeholderCtx, selectedContactId, selectContact } from '../state.js';
import { h, buzz, addDays, today, fmtDate } from '../util.js';
import { icon, sheet, toast, selectEl } from '../ui.js';
import { carousel } from '../components.js';
import { filterItems } from '../shuffle.js';
import { logCallOutcome, createContact, rollWeekend } from '../cadence.js';
import { initFilters } from './scripts.js';

const STAGE_LABEL_SHORT = { opener: 'Opener', contract: 'Contract', reason: 'Reason', situation: 'Situation', problem: 'Problem', consequence: 'Impact', close: 'Close', bridge: 'Bridge' };

function stepsFor(mode) {
  const main = (mode === 'warm'
    ? ['opener', 'bridge', 'situation', 'problem', 'consequence', 'close']
    : ['opener', 'contract', 'reason', 'situation', 'problem', 'consequence', 'close']);
  return { main, any: ['label', 'brushoffs', 'voicemail'] };
}

export async function render(root, { query }) {
  document.body.classList.add('call-mode');
  const contacts = (await db.all('contacts')).sort((a, b) => a.name.localeCompare(b.name));
  if (query.contact) selectContact(query.contact);
  let contact = contacts.find((c) => c.id === (query.contact || selectedContactId())) || null;
  const taskId = query.task || '';
  const acts = contact ? await db.byIndex('activities', 'contactId', contact.id) : [];
  let mode = query.mode === 'warm' || query.mode === 'cold' ? query.mode : (acts.length >= 3 ? 'warm' : 'cold');
  let step = 'opener';
  let lastMain = 'opener';
  let objIdx = 0;
  const used = new Set();
  let car = null;

  const screen = h('div', { class: 'call' });
  root.append(screen);

  const close = () => { if (history.length > 1) history.back(); else location.hash = '#/today'; };

  function finish(res, outcome) {
    buzz(40);
    const msg = res.followUp ? `Logged · ${res.followUp}` : 'Call logged';
    toast(msg, { duration: 3200 });
    location.hash = '#/today';
    void outcome;
  }

  async function log(outcome, notes, date) {
    const res = await logCallOutcome({ contactId: contact ? contact.id : '', taskId, outcome, notes, date, scriptIds: [...used], variant: mode });
    if (outcome === 'wrong_person' && contact) {
      finish(res, outcome);
      askRightPerson(contact);
      return;
    }
    finish(res, outcome);
  }

  function askRightPerson(from) {
    sheet('Who’s the right person?', (done) => {
      const name = h('input', { class: 'input', placeholder: 'Name', autocomplete: 'off' });
      const role = h('input', { class: 'input', placeholder: 'Role (optional)' });
      const phone = h('input', { class: 'input', type: 'tel', placeholder: 'Phone (optional)' });
      return h('div', null,
        h('p', { class: 'muted small' }, `Quick-add them at ${from.company || 'the same company'} and start their cadence.`),
        name, role, phone,
        h('button', {
          class: 'btn', onclick: async () => {
            if (!name.value.trim()) { name.focus(); return; }
            await createContact({
              name: name.value.trim(), role: role.value.trim(), phone: phone.value.trim(),
              company: from.company, site: from.site, sector: from.sector, persona: '',
              source: `Referral from ${from.name}`,
            });
            done();
            toast('Colleague added');
          },
        }, 'Add contact'),
        h('button', { class: 'btn ghost', onclick: done }, 'Skip'));
    });
  }

  function outcomeSheet(o) {
    sheet(o.label, (done) => {
      const notes = h('textarea', { class: 'input', rows: '3', placeholder: 'Notes (optional)' });
      const defaults = { spoke_follow_up: rollWeekend(addDays(today(), 3)), spoke_not_now: rollWeekend(addDays(today(), 14)), meeting: addDays(today(), 7) };
      const label = { spoke_follow_up: 'Call back on', spoke_not_now: 'Call back on', meeting: 'Meeting date (optional)' }[o.id];
      const date = h('input', { class: 'input', type: 'date', value: defaults[o.id] || '' });
      return h('div', null,
        label ? h('label', { class: 'field' }, h('span', null, label), date) : null,
        notes,
        h('button', { class: 'btn' + (o.id === 'meeting' ? ' success' : ''), onclick: async () => { done(); await log(o.id, notes.value, date.value); } }, 'Save & finish'));
    });
  }

  function draw() {
    screen.textContent = '';
    const ctx = placeholderCtx(contact);
    const f = initFilters();
    const { main, any } = stepsFor(mode);

    // header
    screen.append(h('header', { class: 'call-top' },
      h('button', { class: 'icon-btn', 'aria-label': 'Close call mode', onclick: close }, icon('x', 24)),
      h('div', { class: 'who' },
        contact
          ? [h('strong', null, contact.name), h('span', { class: 'muted small' }, [contact.role, contact.company].filter(Boolean).join(' · ') || contact.site || '')]
          : selectEl([{ value: '', label: 'Pick a contact…' }, ...contacts.map((c) => ({ value: c.id, label: c.name }))], '', (v) => { contact = contacts.find((c) => c.id === v) || null; selectContact(v); draw(); })),
      contact && contact.phone ? h('a', { class: 'btn sm', href: `tel:${contact.phone.replace(/\s+/g, '')}` }, icon('phone', 16), 'Dial') : h('span')));

    // mode + voice chips
    screen.append(h('div', { class: 'call-sub' },
      h('div', { class: 'seg compact' },
        ['cold', 'warm'].map((m) => h('button', { class: 'seg-btn' + (m === mode ? ' on' : ''), onclick: () => { mode = m; step = 'opener'; lastMain = 'opener'; draw(); } }, m === 'cold' ? 'Cold' : 'Warm'))),
      h('div', { class: 'voice-chips' },
        [{ id: '', label: 'All' }, ...state.content.meta.voices.filter((v) => v.id !== 'neutral')].map((v) =>
          h('button', { class: 'chip sm' + (f.voice === v.id ? ' on' : ''), onclick: () => { f.voice = v.id; draw(); } }, v.label)))));

    // step chips
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

    const stageInfo = (state.content.stages.concat(state.content.warmStages)).find((s) => s.id === step && (mode === 'warm' ? state.content.warmStages.includes(s) : state.content.stages.includes(s)));
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
      const notes = h('textarea', { class: 'input', rows: '2', placeholder: 'Quick notes (optional)' });
      const grid = h('div', { class: 'outcome-grid big' });
      for (const o of state.content.meta.outcomes) {
        grid.append(h('button', {
          class: 'btn outcome ' + (o.id === 'meeting' ? 'success' : 'ghost'),
          onclick: () => {
            if (['spoke_follow_up', 'spoke_not_now', 'meeting'].includes(o.id)) outcomeSheet(o);
            else log(o.id, notes.value);
          },
        }, o.label));
      }
      bodyEl.append(grid, notes, h('p', { class: 'muted small center' }, 'Logging updates the contact and schedules the next step.'));
      foot.append(h('button', { class: 'btn ghost', onclick: () => { step = lastMain; draw(); } }, icon('arrowLeft', 18), 'Back to call'));
      return;
    }

    let items;
    let title;
    let hint = '';
    if (step === 'brushoffs') {
      title = 'Brush-offs';
      hint = 'Respond, don’t fight. Label it, ask a question.';
      const chipsRow = h('div', { class: 'obj-chips' });
      state.content.brushoffs.forEach((b, i) => chipsRow.append(h('button', { class: 'chip' + (i === objIdx ? ' on' : ''), onclick: () => { objIdx = i; draw(); } }, b.objection)));
      bodyEl.append(h('h2', { class: 'stage-title' }, title), h('p', { class: 'muted' }, hint), chipsRow);
      items = filterItems(state.content.brushoffs[objIdx].responses.map((r) => ({ ...r, personas: [], themes: [] })), f);
    } else if (step === 'voicemail') {
      title = 'Voicemail';
      hint = 'Under 20 seconds. Say your number slowly.';
      bodyEl.append(h('h2', { class: 'stage-title' }, title), h('p', { class: 'muted' }, hint));
      items = filterItems(state.content.byCategory('voicemail'), f);
    } else if (step === 'label') {
      title = 'Name the feeling';
      hint = 'Use any time they sound sceptical, rushed or fed up.';
      bodyEl.append(h('h2', { class: 'stage-title' }, title), h('p', { class: 'muted' }, hint));
      items = filterItems(state.content.byCategory('cold_call', 'label'), f);
    } else {
      const st = stageInfo || { label: step, hint: '' };
      const cat = st.reuse || (mode === 'warm' ? 'warm_call' : 'cold_call');
      bodyEl.append(h('h2', { class: 'stage-title' }, st.label), h('p', { class: 'muted' }, st.hint));
      items = filterItems(state.content.byCategory(cat, step), f);
    }
    car = carousel({ key: `call:${mode}:${step}:${step === 'brushoffs' ? objIdx : ''}`, items, ctx, big: true, onUsed: (id) => used.add(id) });
    bodyEl.append(car);

    foot.append(
      h('button', { class: 'btn ghost', onclick: () => car && car.shuffle && car.shuffle() }, icon('shuffle', 20), 'Shuffle'),
      h('button', { class: 'btn', onclick: next }, nextLabel, icon('right', 20)));
  }

  draw();
  void fmtDate;
  return () => document.body.classList.remove('call-mode');
}
