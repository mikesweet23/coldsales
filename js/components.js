// Shared UI pieces: placeholder text, line cards, carousels
import { h } from './util.js';
import { icon, sheet, toast } from './ui.js';
import { state, resolveToken, plainText, getProspect, setProspect } from './state.js';
import { isFavourite, markUsed, toggleFavourite, usageOf, usedToday, pickRandom } from './shuffle.js';

export function filled(text, ctx, onEdit) {
  const frag = document.createDocumentFragment();
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    const tok = m[1];
    const val = resolveToken(tok, ctx);
    if (val) frag.append(val);
    else {
      frag.append(h('span', {
        class: 'ph', role: 'button', tabindex: '0', title: 'Tap to fill in',
        onclick: (e) => { e.stopPropagation(); askFill(tok, onEdit); },
      }, m[0]));
    }
    last = re.lastIndex;
  }
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}

function askFill(token, onEdit) {
  sheet(`Fill in “${token}”`, (close) => {
    const input = h('input', { class: 'input', type: 'text', placeholder: token, value: state.overrides[token] || '', autocomplete: 'off' });
    const save = () => { const v = input.value.trim(); if (v) state.overrides[token] = v; else delete state.overrides[token]; close(); onEdit && onEdit(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    setTimeout(() => input.focus(), 50);
    return h('div', null,
      h('p', { class: 'muted small' }, 'Used for this session wherever this placeholder appears.'),
      input, h('button', { class: 'btn', onclick: save }, 'Save'));
  });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) { /* ignore */ }
    ta.remove();
  }
  toast('Copied');
}

export function voiceTag(voice) {
  if (!voice || voice === 'neutral') return null;
  const v = state.content.meta.voices.find((x) => x.id === voice);
  return h('span', { class: 'tag tag-' + voice }, v ? v.label : voice);
}

function usedLabel(id) {
  const u = usageOf(id);
  if (!u.lastUsedAt) return '';
  if (usedToday(id)) return 'Used today';
  const days = Math.round((Date.now() - u.lastUsedAt) / 864e5);
  return `Used ${days}d ago`;
}

// A single script line. opts: { copy, big, onUsed(id), sessionUsed:Set }
export function lineCard(script, ctx, opts = {}) {
  const build = () => {
    const rerender = () => card.replaceWith(build());
    const used = usedLabel(script.id);
    const textEl = h('div', { class: 'line-text' + (opts.big ? ' big' : '') });
    textEl.append(filled(script.text, ctx, rerender));
    const markBtn = h('button', {
      class: 'chip-btn' + (usedToday(script.id) ? ' on' : ''), 'aria-label': 'Mark as used',
      onclick: async (e) => { e.stopPropagation(); await markUsed(script.id); opts.onUsed && opts.onUsed(script.id); rerender(); },
    }, icon('check', 16), usedToday(script.id) ? 'Used' : 'Mark used');
    const star = h('button', {
      class: 'icon-btn star' + (isFavourite(script.id) ? ' on' : ''), 'aria-label': 'Favourite', 'aria-pressed': String(isFavourite(script.id)),
      onclick: async (e) => { e.stopPropagation(); await toggleFavourite(script.id); rerender(); },
    }, icon('star', 22));
    const actions = h('div', { class: 'line-actions' }, markBtn);
    if (opts.copy) {
      actions.append(h('button', { class: 'chip-btn', onclick: (e) => { e.stopPropagation(); copyText(plainText(script.text, ctx)); } }, icon('copy', 16), 'Copy'));
    }
    if (opts.extra) actions.append(opts.extra);
    const card = h('div', { class: 'card line' + (usedToday(script.id) ? ' used' : '') },
      h('div', { class: 'line-top' },
        h('div', { class: 'row gap-s' }, voiceTag(script.voice), used ? h('span', { class: 'muted small' }, used) : null),
        star),
      textEl,
      actions);
    if (opts.tapToUse !== false) {
      textEl.addEventListener('click', async () => { await markUsed(script.id); opts.onUsed && opts.onUsed(script.id); rerender(); });
    }
    return card;
  };
  const card = build();
  return card;
}

const carouselIdx = new Map();

// Swipeable line picker with Shuffle. items: script objects.
export function carousel({ key, items, ctx, copy = false, onUsed, big = false, extraActions }) {
  const wrap = h('div', { class: 'carousel' });
  if (!items.length) { wrap.append(h('p', { class: 'muted' }, 'No lines for this filter.')); return wrap; }
  let idx = carouselIdx.has(key) ? carouselIdx.get(key) : -1;
  if (idx < 0 || idx >= items.length) {
    const first = pickRandom(items);
    idx = Math.max(0, items.findIndex((i) => i.id === first.id));
  }
  const go = (n) => { idx = (n + items.length) % items.length; carouselIdx.set(key, idx); draw(); };
  const shuffle = () => {
    const pick = pickRandom(items, items[idx].id);
    go(items.findIndex((i) => i.id === pick.id));
  };
  const draw = () => {
    wrap.textContent = '';
    const cur = items[idx];
    const card = lineCard(cur, ctx, { copy, big, onUsed, extra: extraActions && extraActions(cur) });
    wrap.append(card);
    const nav = h('div', { class: 'car-nav' },
      h('button', { class: 'icon-btn', 'aria-label': 'Previous line', onclick: () => go(idx - 1) }, icon('left', 24)),
      h('span', { class: 'muted small', 'aria-live': 'polite' }, `${idx + 1} / ${items.length}`),
      h('button', { class: 'btn ghost sm', onclick: shuffle }, icon('shuffle', 16), 'Shuffle'),
      h('button', { class: 'icon-btn', 'aria-label': 'Next line', onclick: () => go(idx + 1) }, icon('right', 24)));
    wrap.append(nav);
    let sx = null;
    card.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    card.addEventListener('touchend', (e) => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx;
      sx = null;
      if (Math.abs(dx) > 50) go(idx + (dx < 0 ? 1 : -1));
    });
  };
  draw();
  wrap.go = go;
  wrap.shuffle = shuffle;
  wrap.current = () => items[idx];
  return wrap;
}

export function ladderBar(rung) {
  const bar = h('div', { class: 'ladder', role: 'img', 'aria-label': `Rung ${rung} of 10` });
  for (let i = 1; i <= 10; i++) bar.append(h('span', { class: 'seg-step' + (i <= rung ? ' on' : '') }));
  return bar;
}

export function rungName(rung) {
  const r = state.content.ladder.find((l) => l.rung === rung);
  return r ? r.name : 'New';
}

export function pageHeader(title, { back, right } = {}) {
  return h('div', { class: 'page-head' },
    back ? h('a', { class: 'icon-btn', href: back, 'aria-label': 'Back' }, icon('arrowLeft')) : null,
    h('h1', null, title),
    right || null);
}

export function sectionLabel(text, right) {
  return h('div', { class: 'section-label' }, h('span', null, text), right || null);
}

// Who you're calling right now. Not a CRM — it just fills [Name] and [site]. Pipedrive holds the records.
export function prospectCard(onChange) {
  const p = getProspect();
  const name = h('input', { class: 'input', placeholder: 'First name', value: p.name || '', autocomplete: 'off', 'aria-label': 'Prospect name' });
  const site = h('input', { class: 'input', placeholder: 'Company / site', value: p.company || '', autocomplete: 'off', 'aria-label': 'Prospect company or site' });
  const save = () => { setProspect({ name: name.value.trim(), company: site.value.trim() }); onChange && onChange(); };
  name.addEventListener('change', save);
  site.addEventListener('change', save);
  return h('div', { class: 'prospect' },
    h('div', { class: 'row between' }, h('span', { class: 'muted small' }, 'Who are you calling? Fills [Name] and [site].'),
      (p.name || p.company) ? h('button', { class: 'link small plain', onclick: () => { setProspect({}); onChange && onChange(); } }, 'Clear') : null),
    h('div', { class: 'grid2' }, name, site));
}

export function skillsPicker(selected = new Set()) {
  const wrap = h('div', { class: 'skills-pick' });
  for (const sk of state.content.skills) {
    const btn = h('button', {
      type: 'button', class: 'chip' + (selected.has(sk.id) ? ' on' : ''), 'aria-pressed': String(selected.has(sk.id)),
      onclick: () => { if (selected.has(sk.id)) selected.delete(sk.id); else selected.add(sk.id); btn.classList.toggle('on'); btn.setAttribute('aria-pressed', String(selected.has(sk.id))); },
    }, sk.title.replace('Call out the elephant', 'Elephant').replace('Micro-contracting', 'Micro-contract').replace('Name the feeling', 'Label').replace('Curiosity over pitching', 'Curiosity').replace('Permission to say no', 'Safe “no”'));
    wrap.append(btn);
  }
  return wrap;
}
