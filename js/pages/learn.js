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
  { id: 'hunt', title: 'Hunt for the no', sub: 'Word it so “no” means yes' },
  { id: 'tonality', title: 'Tonality and pacing', sub: 'How to sound calm, curious and certain' },
  { id: 'voices', title: 'Three conversation styles', sub: 'Direct · Curious · Structured' },
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
  root.append(h('div', { class: 'card accent' }, h('strong', null, pd.reminder), h('p', null, 'Pipedrive is the record of every prospect, deal and next step. If it isn’t in Pipedrive, it didn’t happen. The app just makes it painless: you log in seconds while you work, then update Pipedrive in one go.')));
  root.append(sectionLabel('How it works'), h('div', { class: 'card' }, h('ol', { class: 'recipe' }, pd.workflow.map((w) => h('li', null, w)))));
  root.append(h('a', { class: 'btn ghost', href: '#/wrapup' }, icon('check', 18), 'Open the wrap-up sheet'));
  root.append(sectionLabel('For each one in Pipedrive'), h('div', { class: 'card' }, h('ul', { class: 'bullets' }, pd.checklist.map((c) => h('li', null, c)))));
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
  root.append(back(), h('h1', null, 'Three conversation styles'));
  root.append(h('p', { class: 'muted' }, 'This is question-led selling: get the prospect to say the problem out loud. Every script line is tagged with the style it sounds like. Pick the one that sounds like you, or rotate so you never sound the same twice.'));
  for (const v of state.content.voices) {
    root.append(h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h3', null, v.name), h('span', { class: 'tag tag-' + v.id }, v.tag)),
      h('p', null, v.summary),
      h('p', null, h('strong', null, 'Use when: '), v.when),
      h('p', { class: 'muted' }, h('strong', null, 'Watch out: '), v.watch)));
  }
}

function tonality(root) {
  const t = state.content.tonality;
  root.append(back(), h('h1', null, 'Tonality and pacing'), h('p', { class: 'lead' }, t.intro));
  root.append(sectionLabel('Six tones'));
  t.tones.forEach((x) => root.append(h('div', { class: 'card' }, h('h3', null, x.name), h('p', { class: 'small muted' }, `Use for: ${x.when}`), h('p', null, x.how), h('p', { class: 'quote' }, x.example))));
  root.append(sectionLabel('Pacing rules'), h('div', { class: 'card' }, h('ol', { class: 'recipe' }, t.pacing.map((p) => h('li', null, p)))));
  root.append(sectionLabel('Micro-agreements'), h('p', null, t.microAgreements.intro));
  root.append(h('div', { class: 'chain' }, t.microAgreements.lines.map((l) => h('span', { class: 'chip on' }, l))));
  root.append(h('div', { class: 'card' }, h('strong', null, 'Three small yeses, then the ask'), h('ol', { class: 'recipe' }, t.microAgreements.sequence.map((q) => h('li', null, q)))));
  root.append(sectionLabel('The tone for each stage'));
  const map = h('div', { class: 'card' }, h('div', { class: 'map-row head' }, h('span', null, 'Stage'), h('span', null, 'Tone'), h('span', null, 'Pace')));
  t.stageMap.forEach((m) => map.append(h('div', { class: 'map-row' }, h('strong', null, m.stage), h('span', null, m.tone), h('span', null, m.pace))));
  root.append(map);
  root.append(sectionLabel('The objection loop'), h('p', null, t.objectionLoop.intro), h('div', { class: 'card' }, h('ol', { class: 'recipe' }, t.objectionLoop.steps.map((x) => h('li', null, x)))));
  root.append(h('a', { class: 'btn ghost', href: '#/scripts/brushoffs' }, 'See the brush-off scripts', icon('right', 18)));
  root.append(sectionLabel('Practice drills'), h('div', { class: 'card' }, h('ul', { class: 'bullets' }, t.drills.map((d) => h('li', null, d)))));
  root.append(sectionLabel('Common mistakes'), h('div', { class: 'card warn-card' }, h('ul', { class: 'bullets' }, t.mistakes.map((d) => h('li', null, d)))));
}

function hunt(root) {
  const t = state.content.huntNo;
  root.append(back(), h('h1', null, t.title), h('p', { class: 'lead' }, t.summary));
  root.append(sectionLabel('Why it works'), h('div', { class: 'card' }, h('ul', { class: 'bullets' }, t.why.map((x) => h('li', null, x)))));
  root.append(sectionLabel('The formula'), h('div', { class: 'card' }, h('ol', { class: 'recipe' }, t.formula.map((x) => h('li', null, x)))));
  root.append(sectionLabel('Try these'));
  state.content.byCategory('cold_call', 'hunt').slice(0, 6).forEach((l) => root.append(h('div', { class: 'card quote-card' }, `“${l.text}”`)));
  root.append(h('a', { class: 'btn ghost', href: '#/scripts/cold' }, 'All the lines are in Scripts → Cold Call', icon('right', 18)));
  root.append(sectionLabel('What to do with the answer'));
  t.answers.forEach((a) => root.append(h('div', { class: 'card' }, h('div', { class: 'small muted' }, 'They say'), h('strong', null, a.they), h('div', { class: 'small muted' }, 'You say'), h('div', null, a.you))));
  root.append(sectionLabel('Common mistakes'), h('div', { class: 'card warn-card' }, h('ul', { class: 'bullets' }, t.mistakes.map((x) => h('li', null, x)))));
  root.append(h('p', { class: 'muted small' }, t.honesty));
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
    case 'hunt': return hunt(root);
    case 'tonality': return tonality(root);
    case 'voices': return voices(root);
    case 'mushroom': return mushroom(root);
    case 'rules': return rules(root);
    case 'training': return training(root);
    case 'personas': return personas(root);
    default: return index(root);
  }
}
