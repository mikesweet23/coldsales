// Variety logic: shuffle, "Build me a call", usage and favourites.
import { db } from './db.js';
import { state } from './state.js';

const WEEK = 7 * 864e5;

export function usageOf(id) { return state.usage.get(id) || { scriptId: id, lastUsedAt: 0, timesUsed: 0, favourite: false }; }
export function recentlyUsed(id, ms = WEEK) { const u = state.usage.get(id); return !!(u && u.lastUsedAt && Date.now() - u.lastUsedAt < ms); }
export function usedToday(id) { const u = state.usage.get(id); return !!(u && u.lastUsedAt && new Date(u.lastUsedAt).toDateString() === new Date().toDateString()); }
export function isFavourite(id) { return !!(state.usage.get(id) || {}).favourite; }

export async function markUsed(id) {
  const u = { ...usageOf(id), lastUsedAt: Date.now() };
  u.timesUsed = (u.timesUsed || 0) + 1;
  state.usage.set(id, u);
  await db.put('scriptUsage', u);
  return u;
}

export async function toggleFavourite(id) {
  const u = { ...usageOf(id) };
  u.favourite = !u.favourite;
  state.usage.set(id, u);
  await db.put('scriptUsage', u);
  return u.favourite;
}

// Pick a random item, avoiding anything used in the last 7 days when alternatives exist.
// If everything was used recently, take the least recently used.
export function pickRandom(items, currentId) {
  if (!items.length) return null;
  const others = items.filter((i) => i.id !== currentId);
  if (!others.length) return items[0];
  const fresh = others.filter((i) => !recentlyUsed(i.id));
  if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];
  const oldest = Math.min(...others.map((i) => usageOf(i.id).lastUsedAt));
  const pool = others.filter((i) => usageOf(i.id).lastUsedAt === oldest);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Filters: { persona, voice, theme } — empty string means "any".
// Items with no persona/theme tags are general and always pass.
export function matches(item, f) {
  if (!f) return true;
  if (f.voice && item.voice !== f.voice) return false;
  if (f.persona && item.personas && item.personas.length && !item.personas.includes(f.persona)) return false;
  if (f.theme && item.themes && item.themes.length && !item.themes.includes(f.theme)) return false;
  return true;
}

export function filterItems(items, f) {
  const out = items.filter((i) => matches(i, f));
  return out.length ? out : items; // never leave a rep with nothing
}

export const BUILD_PLAN = ['opener', 'contract', 'reason', 'situation', 'situation', 'problem', 'problem', 'consequence', 'solution', 'qualify', 'hunt', 'close'];

export function buildCall(filters) {
  const picked = [];
  const used = new Set();
  for (const stage of BUILD_PLAN) {
    const pool = filterItems(state.content.byCategory('cold_call', stage), filters).filter((s) => !used.has(s.id));
    const pick = pickRandom(pool.length ? pool : state.content.byCategory('cold_call', stage));
    if (pick) { used.add(pick.id); picked.push({ stage, id: pick.id }); }
  }
  return picked;
}

export function rerollIn(plan, index, filters) {
  const stage = plan[index].stage;
  const inUse = new Set(plan.map((p) => p.id));
  const pool = filterItems(state.content.byCategory('cold_call', stage), filters);
  const available = pool.filter((s) => !inUse.has(s.id) || s.id === plan[index].id);
  const pick = pickRandom(available, plan[index].id) || pickRandom(pool, plan[index].id);
  if (pick) plan[index] = { stage, id: pick.id };
  return plan;
}
