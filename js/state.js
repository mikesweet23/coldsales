import { db } from './db.js';
import { firstName, pref } from './util.js';

export const APP_NAME = 'Outbound';
export const TAGLINE = 'Work the client. Every day.';

export const state = {
  content: null,
  settings: null,
  usage: new Map(), // scriptId -> { scriptId, lastUsedAt, timesUsed, favourite }
  overrides: {}, // session-only placeholder fills, e.g. { day: 'Tuesday' }
};

export function defaultSettings() {
  return {
    key: 'main',
    repName: '', repPhone: '', repEmail: '', signature: '',
    targets: { calls: 20, emails: 10, linkedin: 5, mushroom: 2 },
    callDays: [
      { weekday: 2, start: '09:00', end: '11:00' },
      { weekday: 4, start: '09:00', end: '11:00' },
    ],
    defaultVoice: 'any',
    theme: 'dark',
    pipedriveUrl: 'https://app.pipedrive.com',
  };
}

export async function loadContent() {
  const res = await fetch('./data/content.json');
  if (!res.ok) throw new Error('Could not load content');
  state.content = await res.json();
  const c = state.content;
  c.scriptById = new Map();
  for (const s of c.scripts) c.scriptById.set(s.id, s);
  for (const e of c.emails) c.scriptById.set(e.id, e);
  for (const b of c.brushoffs) for (const r of b.responses) c.scriptById.set(r.id, { ...r, category: 'brushoff', stage: 'brushoff' });
  c.byCategory = (cat, stage) => c.scripts.filter((s) => s.category === cat && (!stage || s.stage === stage));
  c.persona = (id) => (c.meta.personas.find((p) => p.id === id) || {}).label || id || '';
  return c;
}

export async function loadState() {
  await db.init();
  const content = await loadContent();
  const saved = await db.get('settings', 'main');
  state.settings = { ...defaultSettings(), ...(saved || {}) };
  state.settings.targets = { ...defaultSettings().targets, ...(saved && saved.targets) };
  if (!saved) await db.put('settings', state.settings);
  const usage = await db.all('scriptUsage');
  state.usage = new Map(usage.map((u) => [u.scriptId, u]));
  applyTheme(state.settings.theme);
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await db.put('settings', state.settings);
  if (patch.theme) applyTheme(patch.theme);
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  pref('theme', theme === 'light' ? 'light' : 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#FFFFFF' : '#0B0B0C');
}

// ---- prospect being worked (not a CRM: Pipedrive holds the records) ----
export function getProspect() {
  try { return JSON.parse(pref('prospect') || '{}') || {}; } catch (e) { return {}; }
}
export function setProspect(p) { pref('prospect', JSON.stringify(p || {})); }

// ---- placeholders ----
export function placeholderCtx(prospect = getProspect()) {
  const s = state.settings;
  return {
    Name: firstName(prospect.name),
    Rep: s.repName,
    Number: s.repPhone,
    site: prospect.site || prospect.company || '',
    company: prospect.company || '',
  };
}

export function resolveToken(token, ctx) {
  return ctx[token] || state.overrides[token] || '';
}

export function plainText(text, ctx) {
  return text.replace(/\[([^\]]+)\]/g, (m, t) => resolveToken(t, ctx) || m);
}
