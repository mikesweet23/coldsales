// "Log it" sheet: record a touch that happened (call, email, LinkedIn, mushroom).
import { state, getProspect } from './state.js';
import { h } from './util.js';
import { sheet } from './ui.js';
import { ACTIVITY_TYPES, logWithFeedback } from './activity.js';
import { skillsPicker } from './components.js';

export function openLogSheet({ type = 'call', scriptIds = [], notes = '', onDone } = {}) {
  sheet('Log it', (close) => {
    let current = type;
    const p = getProspect();
    const who = h('input', { class: 'input', placeholder: 'Who? (name, company)', value: [p.name, p.company].filter(Boolean).join(', '), autocomplete: 'off' });
    const note = h('textarea', { class: 'input', rows: '2', placeholder: 'Notes (optional)' }, notes);
    const picked = new Set();
    const body = h('div');
    const save = async (outcome = 'done') => {
      close();
      await logWithFeedback({ type: current, outcome, who: who.value, notes: note.value, scriptIds, skills: [...picked] });
      onDone && onDone();
    };
    const draw = () => {
      body.textContent = '';
      if (current === 'call') {
        body.append(h('p', { class: 'muted small' }, 'Tap the outcome to log it.'));
        const grid = h('div', { class: 'outcome-grid' });
        for (const o of state.content.meta.outcomes) {
          grid.append(h('button', { class: 'btn outcome ' + (o.id === 'meeting' ? 'good ghost' : 'ghost'), onclick: () => save(o.id) }, o.label));
        }
        body.append(grid, h('p', { class: 'muted small' }, 'Which skills did you use? (optional)'), skillsPicker(picked));
      } else {
        body.append(h('button', { class: 'btn', onclick: () => save('done') }, 'Log it'));
      }
    };
    const chips = h('div', { class: 'tabs-scroll wrapchips' });
    for (const t of ACTIVITY_TYPES) {
      const c = h('button', { class: 'chip' + (t.id === current ? ' on' : ''), onclick: () => { current = t.id; chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); draw(); } }, t.label);
      chips.append(c);
    }
    draw();
    return h('div', null, chips, who, note, body);
  });
}
