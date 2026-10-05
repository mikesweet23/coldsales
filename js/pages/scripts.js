import { state, placeholderCtx, plainText, getProspect } from '../state.js';
import { h, wordCount } from '../util.js';
import { icon, selectEl, toast } from '../ui.js';
import { carousel, lineCard, copyText, voiceTag, filled, sectionLabel, prospectCard } from '../components.js';
import { filterItems, buildCall, rerollIn, markUsed, toggleFavourite, isFavourite, usedToday, usageOf } from '../shuffle.js';
import { logWithFeedback } from '../activity.js';

const TABS = [
  { id: 'cold', label: 'Cold Call' },
  { id: 'warm', label: 'Warm Call' },
  { id: 'gatekeeper', label: 'Gatekeeper' },
  { id: 'cold-email', label: 'Cold Email' },
  { id: 'warm-email', label: 'Warm Email' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'voicemail', label: 'Voicemail & Text' },
  { id: 'brushoffs', label: 'Brush-offs' },
];

let filters = null;
let buildPlan = null;
const sessionUsed = new Set();
const refresh = () => window.dispatchEvent(new Event('outbound:refresh'));

export function initFilters() {
  if (!filters) filters = { persona: '', voice: state.settings.defaultVoice && state.settings.defaultVoice !== 'any' ? state.settings.defaultVoice : '', theme: '' };
  return filters;
}

function filterBar() {
  const f = initFilters();
  const m = state.content.meta;
  const mk = (key, all, opts) => selectEl([{ value: '', label: all }, ...opts], f[key], (v) => { f[key] = v; refresh(); }, { 'aria-label': all });
  return h('div', { class: 'filters three' },
    mk('persona', 'Persona', m.personas.map((p) => ({ value: p.id, label: p.label }))),
    mk('voice', 'Voice', m.voices.map((v) => ({ value: v.id, label: v.label }))),
    mk('theme', 'Service', m.themes.map((t) => ({ value: t.id, label: t.label }))));
}

const whoStr = () => { const p = getProspect(); return [p.name, p.company].filter(Boolean).join(', '); };

function logBtn(type, id, label = 'Log it') {
  return h('button', { class: 'chip-btn', onclick: () => logWithFeedback({ type, who: whoStr(), scriptIds: [id] }) }, icon('check', 16), label);
}

function emailBody(t) {
  let body = t.body;
  const sig = (state.settings.signature || '').trim();
  if (sig) body = body.replace(/\[Rep\]\s*$/, sig);
  return body;
}

function emailCard(t, ctx) {
  const build = () => {
    const rerender = () => card.replaceWith(build());
    const subject = plainText(t.subject, ctx);
    const body = plainText(emailBody(t), ctx);
    const words = wordCount(body);
    const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const card = h('div', { class: 'card email' + (usedToday(t.id) ? ' used' : '') },
      h('div', { class: 'line-top' },
        h('div', { class: 'row gap-s wrap' }, h('strong', null, t.title), voiceTag(t.voice),
          h('span', { class: 'tag' + (words > 100 && t.category === 'cold_email' ? ' warn' : '') }, `${words} words`)),
        h('button', {
          class: 'icon-btn star' + (isFavourite(t.id) ? ' on' : ''), 'aria-label': 'Favourite', 'aria-pressed': String(isFavourite(t.id)),
          onclick: async () => { await toggleFavourite(t.id); rerender(); },
        }, icon('star', 22))),
      h('div', { class: 'email-subject' }, h('span', { class: 'muted small' }, 'Subject'), h('div', null, filled(t.subject, ctx, rerender))),
      h('div', { class: 'email-body' }, filled(emailBody(t), ctx, rerender)),
      h('div', { class: 'line-actions' },
        h('a', {
          class: 'btn sm', href, onclick: async () => {
            await markUsed(t.id); sessionUsed.add(t.id);
            toast('Sent it? Log it.', { action: 'Log email', onAction: () => logWithFeedback({ type: 'email', who: whoStr(), scriptIds: [t.id], variant: t.category === 'warm_email' ? 'warm' : 'cold' }), duration: 9000 });
          },
        }, icon('mail', 16), 'Open in mail'),
        h('button', { class: 'chip-btn', onclick: () => copyText(`Subject: ${subject}\n\n${body}`) }, icon('copy', 16), 'Copy'),
        h('button', { class: 'chip-btn', onclick: () => logWithFeedback({ type: 'email', who: whoStr(), scriptIds: [t.id], variant: t.category === 'warm_email' ? 'warm' : 'cold' }) }, icon('check', 16), 'Log sent'),
        h('button', { class: 'chip-btn' + (usedToday(t.id) ? ' on' : ''), onclick: async () => { await markUsed(t.id); sessionUsed.add(t.id); rerender(); } }, icon('check', 16), usedToday(t.id) ? 'Used' : 'Mark used')),
      usageOf(t.id).lastUsedAt && !usedToday(t.id) ? h('div', { class: 'muted small' }, `Last used ${Math.round((Date.now() - usageOf(t.id).lastUsedAt) / 864e5)}d ago`) : null);
    return card;
  };
  const card = build();
  return card;
}

function callPage(root, ctx, warm) {
  const f = initFilters();
  const stages = warm ? state.content.warmStages : state.content.stages;
  root.append(h('div', { class: 'quick two' },
    h('a', { class: 'btn', href: `#/call?mode=${warm ? 'warm' : 'cold'}` }, icon('play', 18), 'Call Mode'),
    h('a', { class: 'btn ghost', href: '#/scripts/build' }, icon('shuffle', 18), 'Build me a call')));
  stages.forEach((st, i) => {
    const cat = st.reuse || (warm ? 'warm_call' : 'cold_call');
    const items = filterItems(state.content.byCategory(cat, st.id), f);
    root.append(h('div', { class: 'stage' },
      h('div', { class: 'stage-head' }, h('span', { class: 'stage-num' }, i + 1), h('div', null, h('h3', null, st.label), h('p', { class: 'muted small' }, st.hint))),
      carousel({ key: `${warm ? 'w' : 'c'}:${st.id}`, items, ctx, onUsed: (id) => sessionUsed.add(id) })));
  });
  if (!warm) root.append(h('p', { class: 'muted small center' }, 'Gatekeeper, brush-off and voicemail lines have their own tabs above.'));
}

function simpleSection(root, ctx, { title, hint, cat, stage, key, copy = false, extra }) {
  root.append(sectionLabel(title));
  if (hint) root.append(h('p', { class: 'muted small tight' }, hint));
  root.append(carousel({ key, items: filterItems(state.content.byCategory(cat, stage), initFilters()), ctx, copy, onUsed: (id) => sessionUsed.add(id), extraActions: extra }));
}

function linkedinPage(root, ctx, query) {
  const li = state.content.linkedin;
  const f = initFilters();
  const SUBS = [
    { id: 'playbook', label: 'Playbook' }, { id: 'profile', label: 'Your profile' }, { id: 'connect', label: 'Connect' },
    { id: 'comment', label: 'Comment' }, { id: 'reach', label: 'Reach out' }, { id: 'post', label: 'Post' },
  ];
  const sec = SUBS.some((s) => s.id === query.section) ? query.section : 'playbook';
  root.append(h('div', { class: 'tabs-scroll', role: 'tablist' }, SUBS.map((s) => h('a', { class: 'chip sm' + (s.id === sec ? ' on' : ''), href: `#/scripts/linkedin?section=${s.id}` }, s.label))));
  const lineOpts = { copy: true, onUsed: (id) => sessionUsed.add(id) };

  if (sec === 'playbook') {
    root.append(h('p', { class: 'lead' }, 'Connect, comment, and reach out when the time is right. Not just sharing company posts.'));
    root.append(sectionLabel('The 15–30 minute daily routine'));
    li.routine.forEach((r) => root.append(h('div', { class: 'card row-card' }, h('span', { class: 'tag hot' }, r.label), h('span', null, r.text))));
    root.append(h('div', { class: 'quick' }, h('button', { class: 'btn', onclick: () => logWithFeedback({ type: 'linkedin_comment', who: whoStr() }) }, icon('check', 18), 'Log a LinkedIn touch')));
    root.append(sectionLabel('Principles'), h('div', { class: 'card' }, h('ul', { class: 'bullets' }, li.principles.map((p) => h('li', null, p)))));
    root.append(sectionLabel('A simple week'), h('div', { class: 'card list' }, li.weekly.map((w) => h('div', { class: 'cad-row' }, h('span', { class: 'cad-day' }, w.day), h('span', null, w.text)))));
    root.append(sectionLabel('Avoid'), h('div', { class: 'card warn-card' }, h('ul', { class: 'bullets' }, li.mistakes.map((m) => h('li', null, m)))));
    root.append(h('p', { class: 'muted small' }, li.influence));
  } else if (sec === 'profile') {
    root.append(h('p', { class: 'lead' }, li.profile.intro));
    root.append(sectionLabel('Headline: who you help + what you do'));
    li.profile.headlines.forEach((t) => root.append(h('div', { class: 'card' }, h('div', { class: 'line-text' }, filled(t, ctx, refresh)), h('div', { class: 'line-actions' }, h('button', { class: 'chip-btn', onclick: () => copyText(plainText(t, ctx)) }, icon('copy', 16), 'Copy')))));
    root.append(sectionLabel('About section: five short lines'), h('div', { class: 'card' }, h('ol', { class: 'bullets' }, li.profile.about.map((a) => h('li', null, a)))));
    root.append(sectionLabel('Profile checklist'), h('div', { class: 'card' }, h('ul', { class: 'bullets' }, li.profile.checklist.map((c) => h('li', null, c)))));
  } else if (sec === 'connect') {
    root.append(h('p', { class: 'muted' }, 'Personalise it, make it about them, no pitch. Under 200 characters. Aim for 5–10 a day.'));
    root.append(carousel({
      key: 'li:connect', items: filterItems(state.content.byCategory('li_connect', 'connect'), f), ctx, copy: true, onUsed: (id) => sessionUsed.add(id),
      extraActions: (cur) => h('span', { class: 'row gap-s' }, logBtn('linkedin_connect', cur.id), h('span', { class: 'small ' + (plainText(cur.text, ctx).length > 200 ? 'warn-text' : 'muted') }, `${plainText(cur.text, ctx).length}/200`)),
    }));
    root.append(sectionLabel('After they accept'), carousel({ key: 'li:msg', items: filterItems(state.content.byCategory('li_message', 'message'), f), ctx, copy: true, onUsed: (id) => sessionUsed.add(id), extraActions: (cur) => logBtn('linkedin_message', cur.id, 'Log message') }));
  } else if (sec === 'comment') {
    root.append(h('p', { class: 'muted' }, 'A real question or a useful addition. Never just “great post”. Aim for 2–3 thoughtful comments a day.'));
    root.append(carousel({ key: 'li:comment', items: filterItems(state.content.byCategory('li_comment', 'comment'), f), ctx, copy: true, onUsed: (id) => sessionUsed.add(id), extraActions: (cur) => logBtn('linkedin_comment', cur.id, 'Log comment') }));
    root.append(h('div', { class: 'card' }, h('strong', null, 'Who to comment on'), h('ul', { class: 'bullets' },
      h('li', null, 'Your prospects, and the colleagues around them (engineering, facilities, ops, procurement).'),
      h('li', null, 'Their company page when there’s news, but add your own line. Don’t just share it.'),
      h('li', null, 'Industry voices your prospects follow.'),
      h('li', null, 'People commenting on those posts: they’re often your next prospects.'))));
  } else if (sec === 'reach') {
    root.append(h('p', { class: 'muted' }, 'Message when there’s a reason, not on a timer. Pick the trigger that matches what just happened.'));
    li.triggers.forEach((t) => {
      const lines = filterItems(state.content.byCategory('li_trigger', t.id), f);
      root.append(h('div', { class: 'trigger' }, h('h3', null, t.label), h('p', { class: 'muted small' }, `When: ${t.when}`), h('p', { class: 'small' }, t.action)));
      lines.forEach((l) => root.append(lineCard(l, ctx, { ...lineOpts, extra: logBtn('linkedin_message', l.id, 'Log message') })));
    });
  } else if (sec === 'post') {
    root.append(h('p', { class: 'muted' }, 'Help, teach or inspire. Never pitch. Tap to copy, fill the [brackets], add a photo.'));
    const items = filterItems(state.content.byCategory('li_post', 'post'), f);
    items.forEach((p) => root.append(lineCard(p, ctx, { ...lineOpts, tapToUse: false, extra: logBtn('linkedin_post', p.id, 'Log post') })));
    root.append(h('div', { class: 'card' }, h('strong', null, 'After you post'), h('ul', { class: 'bullets' },
      h('li', null, 'Reply to every comment the same day.'),
      h('li', null, 'Comment back on the people who engaged: they’re warm.'),
      h('li', null, 'Message anyone whose comment shows a real problem. That’s a trigger.'))));
  }
}

function brushoffPage(root, ctx) {
  const f = initFilters();
  root.append(h('p', { class: 'muted' }, 'Respond, don’t fight. Label it, ask a question, make “no” safe.'));
  for (const b of state.content.brushoffs) {
    const resp = filterItems(b.responses.map((r) => ({ ...r, personas: [], themes: [] })), f);
    root.append(h('div', { class: 'objection' }, h('span', { class: 'quote-mark' }, '“'), b.objection, h('span', { class: 'quote-mark' }, '”')));
    for (const r of resp) root.append(lineCard(r, ctx, { onUsed: (id) => sessionUsed.add(id) }));
  }
  simpleSection(root, ctx, { title: 'Recover the call', hint: 'When it’s going wrong, say so and reset.', cat: 'recovery', stage: 'recovery', key: 'rc' });
}

function buildPage(root, ctx) {
  const f = initFilters();
  if (!buildPlan) buildPlan = buildCall(f);
  const labels = Object.fromEntries(state.content.stages.map((s) => [s.id, s.label]));
  const holder = h('div');
  const draw = () => {
    holder.textContent = '';
    buildPlan.forEach((p, i) => {
      const script = state.content.scriptById.get(p.id);
      holder.append(h('div', { class: 'stage-mini' }, h('span', { class: 'stage-num' }, i + 1), h('strong', null, labels[p.stage])));
      holder.append(lineCard(script, ctx, {
        onUsed: (id) => sessionUsed.add(id),
        extra: h('button', { class: 'chip-btn', onclick: () => { rerollIn(buildPlan, i, f); draw(); } }, icon('refresh', 16), 'Reroll'),
      }));
    });
  };
  draw();
  root.append(
    h('p', { class: 'muted' }, 'A full call path, one line from each stage. Reroll any line, or rebuild the lot.'),
    h('div', { class: 'quick two' },
      h('button', { class: 'btn', onclick: () => { buildPlan = buildCall(f); draw(); } }, icon('shuffle', 18), 'Build another'),
      h('a', { class: 'btn ghost', href: '#/call?mode=cold' }, icon('play', 18), 'Call Mode')),
    holder,
    h('button', { class: 'btn ghost', onclick: () => copyText(buildPlan.map((p) => plainText(state.content.scriptById.get(p.id).text, ctx)).join('\n\n')) }, icon('copy', 18), 'Copy whole call'));
}

export async function render(root, { parts, query }) {
  const tab = parts[1] || 'cold';
  const ctx = placeholderCtx();

  root.append(h('div', { class: 'page-head' }, h('h1', null, tab === 'build' ? 'Build me a call' : 'Scripts')));
  if (tab !== 'build') {
    root.append(h('div', { class: 'tabs-scroll', role: 'tablist' },
      TABS.map((t) => h('a', { class: 'chip' + (t.id === tab ? ' on' : ''), href: `#/scripts/${t.id}`, role: 'tab', 'aria-selected': String(t.id === tab) }, t.label))));
  } else {
    root.append(h('a', { class: 'back-link', href: '#/scripts/cold' }, icon('arrowLeft', 16), 'Scripts'));
  }
  if (tab !== 'linkedin') root.append(prospectCard(refresh));
  root.append(filterBar());

  const body = h('div', { class: 'script-body' });
  root.append(body);
  switch (tab) {
    case 'cold': callPage(body, ctx, false); break;
    case 'warm': callPage(body, ctx, true); break;
    case 'gatekeeper':
      simpleSection(body, ctx, { title: 'Getting past the gatekeeper', hint: 'Be honest, polite and brief. Ask for help, don’t talk past them.', cat: 'gatekeeper', stage: 'gatekeeper', key: 'gk' });
      simpleSection(body, ctx, { title: 'Ask for the referral', hint: 'Mushrooming: every call is a chance to find the next person.', cat: 'gatekeeper', stage: 'referral', key: 'rf' });
      break;
    case 'cold-email':
    case 'warm-email': {
      const cat = tab === 'cold-email' ? 'cold_email' : 'warm_email';
      body.append(h('div', { class: 'rules-banner' }, tab === 'cold-email'
        ? 'Plain text · under 100 words · one question · no attachments · short, lower-case subject'
        : 'Give before you ask · one useful thing · one soft question'));
      for (const t of filterItems(state.content.emails.filter((e) => e.category === cat), initFilters())) body.append(emailCard(t, ctx));
      break;
    }
    case 'linkedin': linkedinPage(body, ctx, query); break;
    case 'voicemail':
      body.append(h('div', { class: 'rules-banner' }, 'Keep it under 20 seconds. Say your number slowly.'));
      simpleSection(body, ctx, { title: 'Voicemail', cat: 'voicemail', stage: 'voicemail', key: 'vm' });
      simpleSection(body, ctx, { title: 'Text / WhatsApp after a missed call', hint: 'Short and human. One easy question.', cat: 'text', stage: 'text', key: 'tx', copy: true });
      break;
    case 'brushoffs': brushoffPage(body, ctx); break;
    case 'build': buildPage(body, ctx); break;
    default: body.append(h('p', null, 'Unknown section.'));
  }
}
