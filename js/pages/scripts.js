import { db } from '../db.js';
import { state, placeholderCtx, plainText, selectedContactId, selectContact } from '../state.js';
import { h, wordCount } from '../util.js';
import { icon, selectEl } from '../ui.js';
import { carousel, lineCard, copyText, voiceTag, filled, sectionLabel } from '../components.js';
import { filterItems, buildCall, rerollIn, markUsed, toggleFavourite, isFavourite, usedToday, usageOf } from '../shuffle.js';
import { taskBanner } from '../taskui.js';

const TABS = [
  { id: 'cold', label: 'Cold Call' },
  { id: 'warm', label: 'Warm Call' },
  { id: 'cold-email', label: 'Cold Email' },
  { id: 'warm-email', label: 'Warm Email' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'voicemail', label: 'Voicemail' },
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

function linkQs(query) {
  const p = new URLSearchParams();
  if (query.contact) p.set('contact', query.contact);
  if (query.task) p.set('task', query.task);
  const s = p.toString();
  return s ? '?' + s : '';
}

function emailBody(t) {
  let body = t.body;
  const sig = (state.settings.signature || '').trim();
  if (sig) body = body.replace(/\[Rep\]\s*$/, sig);
  return body;
}

function emailCard(t, ctx, contact, suggested) {
  const build = () => {
    const rerender = () => card.replaceWith(build());
    const subject = plainText(t.subject, ctx);
    const body = plainText(emailBody(t), ctx);
    const words = wordCount(body);
    const href = `mailto:${contact && contact.email ? contact.email : ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const subjEl = h('div', { class: 'email-subject' }, h('span', { class: 'muted small' }, 'Subject'), h('div', null, filled(t.subject, ctx, rerender)));
    const bodyEl = h('div', { class: 'email-body' }, filled(emailBody(t), ctx, rerender));
    const card = h('div', { class: 'card email' + (usedToday(t.id) ? ' used' : '') },
      h('div', { class: 'line-top' },
        h('div', { class: 'row gap-s wrap' }, h('strong', null, t.title), voiceTag(t.voice), suggested ? h('span', { class: 'tag hot' }, 'Suggested') : null,
          h('span', { class: 'tag' + (words > 100 && t.category === 'cold_email' ? ' warn' : '') }, `${words} words`)),
        h('button', {
          class: 'icon-btn star' + (isFavourite(t.id) ? ' on' : ''), 'aria-label': 'Favourite', 'aria-pressed': String(isFavourite(t.id)),
          onclick: async () => { await toggleFavourite(t.id); rerender(); },
        }, icon('star', 22))),
      subjEl, bodyEl,
      h('div', { class: 'line-actions' },
        h('a', { class: 'btn sm', href, onclick: async () => { await markUsed(t.id); sessionUsed.add(t.id); } }, icon('mail', 16), contact && contact.email ? 'Open in mail' : 'Open mail app'),
        h('button', { class: 'chip-btn', onclick: () => copyText(`Subject: ${subject}\n\n${body}`) }, icon('copy', 16), 'Copy'),
        h('button', { class: 'chip-btn' + (usedToday(t.id) ? ' on' : ''), onclick: async () => { await markUsed(t.id); sessionUsed.add(t.id); rerender(); } }, icon('check', 16), usedToday(t.id) ? 'Used' : 'Mark used')),
      usageOf(t.id).lastUsedAt && !usedToday(t.id) ? h('div', { class: 'muted small' }, `Last used ${Math.round((Date.now() - usageOf(t.id).lastUsedAt) / 864e5)}d ago`) : null);
    return card;
  };
  const card = build();
  return card;
}

function coldCallPage(root, ctx, contact, query, warm) {
  const f = initFilters();
  const stages = warm ? state.content.warmStages : state.content.stages;
  const callHref = `#/call?mode=${warm ? 'warm' : 'cold'}${contact ? '&contact=' + contact.id : ''}${query.task ? '&task=' + query.task : ''}`;
  root.append(h('div', { class: 'quick two' },
    h('a', { class: 'btn', href: callHref }, icon('play', 18), 'Call Mode'),
    h('a', { class: 'btn ghost', href: `#/scripts/build${contact ? '?contact=' + contact.id : ''}` }, icon('shuffle', 18), 'Build me a call')));
  stages.forEach((st, i) => {
    const cat = st.reuse || (warm ? 'warm_call' : 'cold_call');
    const items = filterItems(state.content.byCategory(cat, st.id), f);
    root.append(h('div', { class: 'stage' },
      h('div', { class: 'stage-head' }, h('span', { class: 'stage-num' }, i + 1), h('div', null, h('h3', null, st.label), h('p', { class: 'muted small' }, st.hint))),
      carousel({ key: `${warm ? 'w' : 'c'}:${st.id}`, items, ctx, onUsed: (id) => sessionUsed.add(id) })));
  });
  if (!warm) {
    root.append(h('p', { class: 'muted small center' }, 'Brush-offs and voicemail lines have their own tabs above.'));
  }
}

function linkedinPage(root, ctx, contact, query) {
  const f = initFilters();
  if (contact && contact.linkedin) {
    root.append(h('a', { class: 'btn ghost', href: contact.linkedin, target: '_blank', rel: 'noopener' }, icon('linkedin', 18), `Open ${contact.name.split(' ')[0]}’s profile`));
  }
  const sections = [
    { id: 'connect', cat: 'li_connect', title: 'Connection notes', hint: 'Under 200 characters. No pitch.', copy: true, car: true },
    { id: 'engage', cat: 'li_engage', title: 'Post engagement ideas', hint: 'Be a human before you’re a seller.', copy: false, car: false },
    { id: 'message', cat: 'li_message', title: 'Messages after connecting', hint: 'Value, not pitch.', copy: true, car: true },
    { id: 'post', cat: 'li_post', title: 'Your own posts (weekly)', hint: 'One a week keeps you visible.', copy: false, car: false },
  ];
  const first = sections.findIndex((s) => s.id === query.section);
  if (first > 0) sections.unshift(...sections.splice(first, 1));
  for (const s of sections) {
    const items = filterItems(state.content.byCategory(s.cat, s.id), f);
    root.append(sectionLabel(s.title), h('p', { class: 'muted small tight' }, s.hint));
    if (s.car) {
      root.append(carousel({
        key: 'li:' + s.id, items, ctx, copy: true, onUsed: (id) => sessionUsed.add(id),
        extraActions: s.id === 'connect' ? (cur) => {
          const n = plainText(cur.text, ctx).length;
          return h('span', { class: 'small ' + (n > 200 ? 'warn-text' : 'muted') }, `${n}/200`);
        } : null,
      }));
    } else {
      for (const it of items) root.append(lineCard(it, ctx, { onUsed: (id) => sessionUsed.add(id), tapToUse: false }));
    }
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
}

function buildPage(root, ctx, contact) {
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
    h('p', { class: 'muted' }, 'A full call path — one line from each stage. Reroll any line, or rebuild the lot.'),
    h('div', { class: 'quick two' },
      h('button', { class: 'btn', onclick: () => { buildPlan = buildCall(f); draw(); } }, icon('shuffle', 18), 'Build another'),
      h('a', { class: 'btn ghost', href: `#/call?mode=cold${contact ? '&contact=' + contact.id : ''}` }, icon('play', 18), 'Call Mode')),
    holder,
    h('button', {
      class: 'btn ghost', onclick: () => copyText(buildPlan.map((p) => plainText(state.content.scriptById.get(p.id).text, ctx)).join('\n\n')),
    }, icon('copy', 18), 'Copy whole call'));
}

export async function render(root, { parts, query }) {
  const tab = parts[1] || 'cold';
  if (query.contact) selectContact(query.contact);
  const contacts = (await db.all('contacts')).sort((a, b) => a.name.localeCompare(b.name));
  const sel = selectedContactId();
  const contact = contacts.find((c) => c.id === sel) || null;
  const ctx = placeholderCtx(contact);
  const q = { ...query, contact: contact ? contact.id : '' };
  const qs = linkQs(q);

  const banner = await taskBanner(query.task, () => [...sessionUsed]);
  if (banner) root.append(banner);

  root.append(h('div', { class: 'page-head' }, h('h1', null, tab === 'build' ? 'Build me a call' : 'Scripts')));
  if (tab !== 'build') {
    root.append(h('div', { class: 'tabs-scroll', role: 'tablist' },
      TABS.map((t) => h('a', { class: 'chip' + (t.id === tab ? ' on' : ''), href: `#/scripts/${t.id}${qs}`, role: 'tab', 'aria-selected': String(t.id === tab) }, t.label))));
  } else {
    root.append(h('a', { class: 'back-link', href: '#/scripts/cold' }, icon('arrowLeft', 16), 'Scripts'));
  }

  // contact picker
  const picker = selectEl(
    [{ value: '', label: 'No contact — fill in manually' }, ...contacts.map((c) => ({ value: c.id, label: `${c.name}${c.company ? ' — ' + c.company : ''}` }))],
    contact ? contact.id : '',
    (v) => { selectContact(v); refresh(); }, { 'aria-label': 'Contact for placeholders' });
  root.append(h('div', { class: 'picker' }, icon('pipeline', 18), picker));
  root.append(filterBar());

  const body = h('div', { class: 'script-body' });
  root.append(body);
  switch (tab) {
    case 'cold': coldCallPage(body, ctx, contact, q, false); break;
    case 'warm': coldCallPage(body, ctx, contact, q, true); break;
    case 'cold-email':
    case 'warm-email': {
      const cat = tab === 'cold-email' ? 'cold_email' : 'warm_email';
      body.append(h('div', { class: 'rules-banner' }, tab === 'cold-email'
        ? 'Plain text · under 100 words · one question · no attachments · short, lower-case subject'
        : 'Give before you ask · one useful thing · one soft question'));
      let items = filterItems(state.content.emails.filter((e) => e.category === cat), initFilters());
      const hint = query.hint || '';
      const sug = items.find((e) => e.id === hint);
      if (sug) items = [sug, ...items.filter((e) => e !== sug)];
      for (const t of items) body.append(emailCard(t, ctx, contact, sug && t.id === sug.id));
      break;
    }
    case 'linkedin': linkedinPage(body, ctx, contact, q.section ? q : query); break;
    case 'voicemail':
      body.append(h('div', { class: 'rules-banner' }, 'Keep it under 20 seconds. Say your number slowly.'));
      body.append(carousel({ key: 'vm', items: filterItems(state.content.byCategory('voicemail'), initFilters()), ctx, copy: false, onUsed: (id) => sessionUsed.add(id) }));
      break;
    case 'brushoffs': brushoffPage(body, ctx); break;
    case 'build': buildPage(body, ctx, contact); break;
    default: body.append(h('p', null, 'Unknown section.'));
  }
}
