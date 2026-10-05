import { state } from '../state.js';
import { h } from '../util.js';
import { icon } from '../ui.js';
import { TYPE_ICON } from '../activity.js';
import { sectionLabel } from '../components.js';

const SECTIONS = [
  { id: 'pipedrive', title: 'Keep Pipedrive up to date', sub: 'The record that keeps you on track' },
  { id: 'ladder', title: 'The Outreach Ladder', sub: '10 rungs from cold to meeting' },
  { id: 'cadence', title: 'The 21-day Cadence', sub: 'The rhythm for every prospect' },
  { id: 'skills', title: 'The 5 Core Skills', sub: 'Behaviours that run across every touch' },
  { id: 'voices', title: 'The three voices', sub: 'Dennehy · NEPQ · Sandler' },
  { id: 'linkedin', title: 'LinkedIn playbook', sub: 'Connect, comment, reach out at the right time', href: '#/scripts/linkedin' },
  { id: 'mushroom', title: 'Mushrooming', sub: 'Multi-threading an account' },
  { id: 'rules', title: 'Email & LinkedIn rules', sub: 'Keep it short, human and honest' },
  { id: 'training', title: '90-minute training', sub: 'The session run sheet' },
  { id: 'personas', title: 'Practice persona cards', sub: 'Role-play briefs' },
];

const back = (to = '#/learn', label = 'Learn') => h('a', { class: 'back-link', href: to }, icon('arrowLeft', 16), label);
const bullets = (arr) => h('ul', { class: 'bullets' }, arr.map((t) => h('li', null, t)));

function index(root) {
  root.append(h('div', { class: 'page-head col' }, h('h1', null, 'Learn'), h('p', { class: 'muted' }, 'The framework behind the app. Ten minutes here makes every call easier.')));
  for (const s of SECTIONS) {
    root.append(h('a', { class: 'card nav-card', href: s.href || `#/learn/${s.id}` },
      h('div', null, h('strong', null, s.title), h('div', { class: 'muted small' }, s.sub)), icon('right', 18)));
  }
}

function pipedrive(root) {
  const pd = state.content.pipedrive;
  root.append(back(), h('h1', null, 'Keep Pipedrive up to date'));
  root.append(h('div', { class: 'card accent' }, h('strong', null, pd.reminder), h('p', null, 'This app tracks your activity: dials, emails, LinkedIn and results. Pipedrive is the record of every prospect, deal and next step. If it isn’t in Pipedrive, it didn’t happen.')));
  root.append(sectionLabel('After every touch'), h('div', { class: 'card' }, h('ul', { class: 'bullets' }, pd.checklist.map((c) => h('li', null, c)))));
  root.append(h('button', { class: 'btn', onclick: () => import('../activity.js').then((m) => m.openPipedrive()) }, icon('external', 18), 'Open Pipedrive'));
}

function ladder(root) {
  root.append(back(), h('h1', null, 'The Outreach Ladder'));
  root.append(h('p', { class: 'muted' }, 'Working the client means moving each prospect up the ladder — from cold, to warm, to meeting. A prospect is never just “called once”. Keep their rung up to date in Pipedrive. Tap a rung.'));
  const wrap = h('div', { class: 'rungs' });
  const rungs = [...state.content.ladder].reverse();
  for (const r of rungs) {
    const item = h('div', { class: 'rung' + (r.rung === 9 ? ' goal' : '') });
    const btn = h('button', { class: 'rung-head', 'aria-expanded': 'false', onclick: () => { const o = item.classList.toggle('open'); btn.setAttribute('aria-expanded', String(o)); } },
      h('span', { class: 'rung-n' }, r.rung), h('span', { class: 'rung-t' }, h('strong', null, r.name), h('span', { class: 'muted small' }, r.purpose)), icon('down', 18, 'chev'));
    item.append(btn, h('div', { class: 'rung-body' }, r.detail));
    wrap.append(item);
  }
  root.append(wrap);
}

function cadence(root) {
  root.append(back(), h('h1', null, 'The 21-day Cadence'));
  root.append(h('p', { class: 'muted' }, 'Set these up as activities in Pipedrive for every prospect, and use this app to do and log the work. One call is not a strategy — 8–10 touches across channels is.'));
  const days = new Map();
  for (const c of state.content.cadence) { if (!days.has(c.day)) days.set(c.day, []); days.get(c.day).push(c); }
  const card = h('div', { class: 'card list' });
  for (const [day, items] of days) {
    card.append(h('div', { class: 'cad-row' }, h('span', { class: 'cad-day' }, `Day ${day}`),
      h('div', null, items.map((i) => h('div', { class: 'cad-item' }, icon(TYPE_ICON[i.type] || 'check', 16), i.label)))));
  }
  card.append(h('div', { class: 'cad-row' }, h('span', { class: 'cad-day' }, 'Day 21+'), h('div', null, h('div', { class: 'cad-item' }, 'Move to Nurture (every 4–6 weeks) or Meeting'))));
  root.append(card, h('p', { class: 'muted small' }, 'Ensure you update Pipedrive after each step to keep track.'));
}

function skills(root) {
  root.append(back(), h('h1', null, 'The 5 Core Skills'));
  root.append(h('p', { class: 'muted' }, 'These run across every call, email and message.'));
  for (const s of state.content.skills) {
    root.append(h('a', { class: 'card skill-card', href: `#/learn/skill/${s.id}` },
      h('div', { class: 'tag' }, `Skill ${s.num}`), h('h3', null, s.title), h('p', { class: 'muted' }, s.summary)));
  }
}

function skillDetail(root, id) {
  const s = state.content.skills.find((x) => x.id === id);
  if (!s) { root.append(back('#/learn/skills', 'Skills'), h('p', null, 'Not found.')); return; }
  const idx = state.content.skills.indexOf(s);
  const nextS = state.content.skills[(idx + 1) % state.content.skills.length];
  root.append(back('#/learn/skills', 'Skills'), h('div', { class: 'tag' }, `Skill ${s.num}`), h('h1', null, s.title));
  root.append(h('p', { class: 'lead' }, s.summary));
  root.append(sectionLabel('Why it works'), h('p', null, s.why));
  root.append(sectionLabel('Example lines'));
  s.examples.forEach((e) => root.append(h('div', { class: 'card quote-card' }, `“${e}”`)));
  root.append(sectionLabel('Try it out loud'), h('div', { class: 'card accent' }, s.practice));
  root.append(sectionLabel('Common mistake'), h('div', { class: 'card warn-card' }, s.mistake));
  root.append(h('a', { class: 'btn ghost', href: `#/learn/skill/${nextS.id}` }, `Next: ${nextS.title}`, icon('right', 18)));
}

function voices(root) {
  root.append(back(), h('h1', null, 'The three voices'));
  root.append(h('p', { class: 'muted' }, 'Every script line is tagged with the voice it sounds like. Pick the one that sounds like you — or rotate so you never sound the same twice. Influences are paraphrased, not quoted.'));
  for (const v of state.content.voices) {
    root.append(h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h3', null, v.name), h('span', { class: 'tag tag-' + v.id }, v.tag)),
      h('p', null, v.summary),
      h('p', null, h('strong', null, 'Use when: '), v.when),
      h('p', { class: 'muted' }, h('strong', null, 'Watch out: '), v.watch)));
  }
}

function mushroom(root) {
  const m = state.content.mushroom;
  root.append(back(), h('h1', null, 'Mushrooming'), h('p', { class: 'lead' }, m.intro));
  root.append(sectionLabel('Typical map'));
  root.append(h('div', { class: 'chain' }, m.map.map((x, i) => [h('span', { class: 'chip on' }, x), i < m.map.length - 1 ? icon('right', 14) : null])));
  root.append(sectionLabel('Checklist per account'), bullets(m.checklist));
  root.append(sectionLabel('Questions that open doors'));
  m.questions.forEach((q) => root.append(h('div', { class: 'card quote-card' }, `“${q}”`)));
  root.append(h('a', { class: 'btn ghost', href: '#/scripts/warm-email' }, 'Referral email templates', icon('right', 18)));
}

function rules(root) {
  root.append(back(), h('h1', null, 'Email & LinkedIn rules'));
  root.append(sectionLabel('Cold email'), h('div', { class: 'card' }, bullets(state.content.rules.email)));
  root.append(sectionLabel('LinkedIn'), h('div', { class: 'card' }, bullets(state.content.rules.linkedin)));
}

function training(root) {
  root.append(back(), h('h1', null, '90-minute training'));
  root.append(h('p', { class: 'muted' }, 'The run sheet for the team session. Revisit it any time.'));
  for (const t of state.content.training) {
    root.append(h('div', { class: 'card' }, h('div', { class: 'tag' }, t.time), h('h3', null, t.title), h('p', { class: 'muted' }, t.body)));
  }
  root.append(h('a', { class: 'btn ghost', href: '#/learn/personas' }, 'Practice persona cards', icon('right', 18)));
}

function personas(root) {
  root.append(back(), h('h1', null, 'Practice persona cards'));
  root.append(h('p', { class: 'muted' }, 'Caller, prospect, observer. Rotate. Observer ticks off: elephant · contract · label · question · close.'));
  state.content.personaCards.forEach((p, i) => {
    root.append(h('div', { class: 'card' },
      h('div', { class: 'tag' }, `Card ${i + 1}`), h('h3', null, p.title), h('p', { class: 'quote' }, p.headline),
      h('p', null, p.situation),
      h('div', { class: 'small muted' }, 'Likely objections'), bullets(p.objections),
      h('div', { class: 'small muted' }, 'A good outcome'), h('p', null, p.goodOutcome)));
  });
}

export async function render(root, { parts }) {
  const [, sec, id] = parts;
  if (!sec) return index(root);
  switch (sec) {
    case 'pipedrive': return pipedrive(root);
    case 'ladder': return ladder(root);
    case 'cadence': return cadence(root);
    case 'skills': return skills(root);
    case 'skill': return skillDetail(root, id);
    case 'voices': return voices(root);
    case 'mushroom': return mushroom(root);
    case 'rules': return rules(root);
    case 'training': return training(root);
    case 'personas': return personas(root);
    default: return index(root);
  }
}
