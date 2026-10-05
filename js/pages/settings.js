import { db } from '../db.js';
import { state, saveSettings, defaultSettings, APP_NAME } from '../state.js';
import { h, download, today } from '../util.js';
import { icon, selectEl, toast, confirmDialog, segmented } from '../ui.js';
import { TYPE_LABEL } from '../cadence.js';
import { sectionLabel } from '../components.js';

const refresh = () => window.dispatchEvent(new Event('outbound:refresh'));
const saved = () => toast('Saved', { duration: 1200 });
const WEEK = [{ d: 1, l: 'Mon' }, { d: 2, l: 'Tue' }, { d: 3, l: 'Wed' }, { d: 4, l: 'Thu' }, { d: 5, l: 'Fri' }, { d: 6, l: 'Sat' }, { d: 0, l: 'Sun' }];

function field(label, input, hint) { return h('label', { class: 'field' }, h('span', null, label), input, hint ? h('span', { class: 'muted small' }, hint) : null); }

function textInput(key, attrs = {}) {
  const el = h('input', { class: 'input', value: state.settings[key] || '', ...attrs });
  el.addEventListener('change', async () => { await saveSettings({ [key]: el.value.trim() }); saved(); });
  return el;
}

export async function render(root) {
  const s = state.settings;
  root.append(h('div', { class: 'page-head' }, h('a', { class: 'icon-btn', href: '#/today', 'aria-label': 'Back' }, icon('arrowLeft')), h('h1', null, 'Settings')));

  // Profile
  root.append(sectionLabel('You'));
  const sig = h('textarea', { class: 'input', rows: '3', placeholder: 'Replaces [Rep] at the end of emails. Leave blank to use your name.' }, s.signature || '');
  sig.addEventListener('change', async () => { await saveSettings({ signature: sig.value }); saved(); });
  root.append(h('div', { class: 'card form' },
    field('Your name', textInput('repName', { autocomplete: 'name', placeholder: 'Used for [Rep]' })),
    field('Phone', textInput('repPhone', { type: 'tel', inputmode: 'tel', placeholder: 'Used for [Number] in voicemails' })),
    field('Email', textInput('repEmail', { type: 'email', inputmode: 'email' })),
    field('Email signature', sig)));

  // Targets
  root.append(sectionLabel('Daily targets'));
  const tg = h('div', { class: 'card grid2' });
  for (const [k, l] of [['calls', 'Calls'], ['emails', 'Emails'], ['linkedin', 'LinkedIn'], ['mushroom', 'Mushroom']]) {
    const inp = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: '0', max: '999', value: s.targets[k] });
    inp.addEventListener('change', async () => { const v = Math.max(0, parseInt(inp.value, 10) || 0); inp.value = v; await saveSettings({ targets: { ...state.settings.targets, [k]: v } }); saved(); });
    tg.append(field(l, inp));
  }
  root.append(tg);

  // Call days
  root.append(sectionLabel('Planned call days'), h('p', { class: 'muted small tight' }, 'Your power hours. They show on the Tracker calendar as outlined cells.'));
  const callCard = h('div', { class: 'card' });
  const drawDays = () => {
    callCard.textContent = '';
    const days = state.settings.callDays || [];
    callCard.append(h('div', { class: 'daypick' }, WEEK.map((w) => {
      const on = days.some((c) => c.weekday === w.d);
      return h('button', {
        class: 'chip' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick: async () => {
          const next = on ? days.filter((c) => c.weekday !== w.d) : [...days, { weekday: w.d, start: '09:00', end: '11:00' }];
          await saveSettings({ callDays: next });
          drawDays();
        },
      }, w.l);
    })));
    for (const w of WEEK) {
      const c = days.find((x) => x.weekday === w.d);
      if (!c) continue;
      const mk = (key) => {
        const i = h('input', { class: 'input', type: 'time', value: c[key] });
        i.addEventListener('change', async () => { c[key] = i.value; await saveSettings({ callDays: [...days] }); saved(); });
        return i;
      };
      callCard.append(h('div', { class: 'time-row' }, h('strong', null, w.l), mk('start'), h('span', { class: 'muted' }, 'to'), mk('end')));
    }
  };
  drawDays();
  root.append(callCard);

  // Preferences
  root.append(sectionLabel('Preferences'));
  root.append(h('div', { class: 'card form' },
    field('Default voice', selectEl([{ value: 'any', label: 'Any (show all)' }, ...state.content.meta.voices.filter((v) => v.id !== 'neutral').map((v) => ({ value: v.id, label: v.label }))], s.defaultVoice, async (v) => { await saveSettings({ defaultVoice: v }); saved(); }), 'Pre-selects the voice filter on the Scripts page after a restart.'),
    h('div', { class: 'field' }, h('span', null, 'Theme'), segmented([{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }], s.theme, async (v) => { await saveSettings({ theme: v }); refresh(); }))));
  const wk = h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: s.skipWeekends ? true : null }), h('span', null, 'Skip weekends when scheduling tasks'));
  wk.querySelector('input').addEventListener('change', async (e) => { await saveSettings({ skipWeekends: e.target.checked }); saved(); });
  root.append(h('div', { class: 'card' }, wk));

  // Cadence
  root.append(sectionLabel('Cadence'), h('p', { class: 'muted small tight' }, 'Applies to contacts you add from now on.'));
  const cadCard = h('div', { class: 'card' });
  const drawCad = () => {
    cadCard.textContent = '';
    const steps = state.settings.cadence;
    steps.forEach((st, i) => {
      const day = h('input', { class: 'input day', type: 'number', inputmode: 'numeric', min: '1', max: '120', value: st.day, 'aria-label': 'Day' });
      day.addEventListener('change', async () => { st.day = Math.max(1, parseInt(day.value, 10) || 1); await saveSettings({ cadence: [...steps].sort((a, b) => a.day - b.day) }); drawCad(); });
      const type = selectEl(Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l })), st.type, async (v) => { st.type = v; await saveSettings({ cadence: [...steps] }); saved(); }, { 'aria-label': 'Type' });
      const label = h('input', { class: 'input', value: st.label, 'aria-label': 'Label' });
      label.addEventListener('change', async () => { st.label = label.value; await saveSettings({ cadence: [...steps] }); saved(); });
      cadCard.append(h('div', { class: 'cad-edit' },
        h('div', { class: 'row gap-s' }, h('span', { class: 'muted small' }, 'Day'), day, type,
          h('button', { class: 'icon-btn', 'aria-label': 'Remove step', onclick: async () => { steps.splice(i, 1); await saveSettings({ cadence: steps }); drawCad(); } }, icon('trash', 18))),
        label));
    });
    cadCard.append(h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn ghost sm', onclick: async () => { const last = steps[steps.length - 1]; await saveSettings({ cadence: [...steps, { day: last ? last.day + 7 : 1, type: 'email', label: 'New step', templateHint: '' }] }); drawCad(); } }, icon('plus', 16), 'Add step'),
      h('button', { class: 'btn ghost sm', onclick: async () => { if (await confirmDialog('Reset the cadence to the default 21-day sequence?', 'Reset')) { await saveSettings({ cadence: defaultSettings(state.content).cadence }); drawCad(); toast('Cadence reset'); } } }, icon('refresh', 16), 'Reset to default')));
  };
  drawCad();
  root.append(cadCard);

  // Data
  root.append(sectionLabel('Data'), h('p', { class: 'muted small tight' }, 'Everything is stored on this device only. Export a backup now and then.'));
  const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!(await confirmDialog('Importing replaces everything currently on this device. Continue?', 'Import', true))) return;
      await db.importAll(data);
      const st = await db.get('settings', 'main');
      if (st) { state.settings = { ...defaultSettings(state.content), ...st, targets: { ...defaultSettings(state.content).targets, ...st.targets } }; }
      state.usage = new Map((await db.all('scriptUsage')).map((u) => [u.scriptId, u]));
      await saveSettings({});
      toast('Backup imported');
      refresh();
    } catch (e) { toast('That file isn’t a valid Outbound backup'); }
    file.value = '';
  });
  root.append(h('div', { class: 'card stack' },
    h('button', { class: 'btn ghost', onclick: async () => { download(`outbound-backup-${today()}.json`, JSON.stringify(await db.exportAll(), null, 1)); toast('Backup downloaded'); } }, icon('download', 18), 'Export JSON backup'),
    h('button', { class: 'btn ghost', onclick: () => file.click() }, icon('upload', 18), 'Import backup'),
    file,
    h('button', {
      class: 'btn ghost danger-text', onclick: async () => {
        if (await confirmDialog('This deletes all contacts, tasks, history and settings from this device. It cannot be undone.', 'Delete everything', true)) {
          await db.clearAll();
          state.settings = defaultSettings(state.content);
          state.usage = new Map();
          await saveSettings({});
          toast('All data cleared');
          location.hash = '#/today';
          refresh();
        }
      },
    }, icon('trash', 18), 'Clear all data')));

  root.append(h('div', { class: 'card' }, h('strong', null, 'Install on your phone'),
    h('p', { class: 'muted small' }, 'iPhone: Share → Add to Home Screen. Android: menu → Install app / Add to Home screen. It then works fully offline.')));
  root.append(h('p', { class: 'muted small center' }, `${APP_NAME} v${state.content.version}`));
}
