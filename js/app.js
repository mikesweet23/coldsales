import { loadState, APP_NAME } from './state.js';
import { h } from './util.js';
import { icon, toast } from './ui.js';
import * as today from './pages/today.js';
import * as scripts from './pages/scripts.js';
import * as callmode from './pages/callmode.js';
import * as tracker from './pages/tracker.js';
import * as learn from './pages/learn.js';
import * as settings from './pages/settings.js';
import * as wrapup from './pages/wrapup.js';

const PAGES = { today, scripts, call: callmode, tracker, learn, settings, wrapup };
const TABS = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'scripts', label: 'Scripts', icon: 'scripts' },
  { id: 'tracker', label: 'Tracker', icon: 'tracker' },
  { id: 'learn', label: 'Learn', icon: 'learn' },
];
const TAB_FOR = { call: 'scripts', wrapup: 'today' };

let cleanup = null;
let token = 0;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { parts: parts.length ? parts : ['today'], query };
}

function buildChrome() {
  const bar = document.getElementById('tabbar');
  bar.textContent = '';
  for (const t of TABS) {
    bar.append(h('a', { class: 'tab', id: 'tab-' + t.id, href: `#/${t.id}`, 'aria-label': t.label }, icon(t.icon, 24), h('span', null, t.label)));
  }
  const appbar = document.getElementById('appbar');
  appbar.append(
    h('a', { class: 'brand', href: '#/today', 'aria-label': `${APP_NAME} home` }, icon('arrowUp', 22, 'red'), h('span', null, APP_NAME.toUpperCase())),
    h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Settings' }, icon('settings', 24)));
}

async function route(keepScroll = false) {
  const my = ++token;
  const { parts, query } = parseHash();
  if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
  document.body.classList.remove('call-mode');
  const page = PAGES[parts[0]] || PAGES.today;
  const view = document.getElementById('view');
  const inner = h('div', { class: 'view-inner' });
  const y = keepScroll ? window.scrollY : 0;
  try {
    const c = await page.render(inner, { parts, query });
    if (my !== token) { if (typeof c === 'function') c(); return; }
    cleanup = typeof c === 'function' ? c : null;
  } catch (e) {
    console.error(e);
    inner.append(h('div', { class: 'card' }, h('h3', null, 'Something went wrong'), h('p', { class: 'muted small' }, String(e && e.message || e))));
  }
  view.replaceChildren(inner);
  const active = TAB_FOR[parts[0]] || parts[0];
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.id === 'tab-' + active;
    t.classList.toggle('on', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
  window.scrollTo(0, y);
}

function promptUpdate(worker) {
  toast('New version available', { action: 'Tap to refresh', duration: 0, onAction: () => worker.postMessage('SKIP_WAITING') });
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(nw); });
    });
  }).catch((e) => console.warn('SW registration failed', e));
  // Reload only when an existing controller is replaced (an update), not on first install.
  let reloading = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadController || reloading) return; reloading = true; location.reload(); });
}

async function boot() {
  try {
    await loadState();
  } catch (e) {
    console.error(e);
    document.getElementById('view').replaceChildren(h('div', { class: 'card' }, h('h3', null, 'Could not start'), h('p', { class: 'muted' }, 'Please reload. If this keeps happening, clear site data and try again.')));
    return;
  }
  buildChrome();
  if (!location.hash) location.replace('#/today');
  window.addEventListener('hashchange', () => route());
  window.addEventListener('outbound:refresh', () => route(true));
  await route();
  registerSW();
}

boot();
