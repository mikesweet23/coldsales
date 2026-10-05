// Power hour timer with pause and reset. State lives in localStorage so it survives navigation.
import { pref, buzz } from './util.js';

export function readPower() {
  try { return JSON.parse(pref('power') || 'null'); } catch (e) { return null; }
}
function write(p) { pref('power', p ? JSON.stringify(p) : null); return p; }

// p = { minutes, startedAt|null, running, endsAt|null, remainingMs }
export function startPower(minutes) {
  const total = minutes * 60000;
  return write({ minutes, startedAt: Date.now(), running: true, endsAt: Date.now() + total, remainingMs: total });
}
export function remainingMs(p) {
  if (!p) return 0;
  return p.running ? Math.max(0, p.endsAt - Date.now()) : Math.max(0, p.remainingMs);
}
export function pausePower() {
  const p = readPower();
  if (!p || !p.running) return p;
  return write({ ...p, running: false, remainingMs: Math.max(0, p.endsAt - Date.now()), endsAt: null });
}
export function resumePower() {
  const p = readPower();
  if (!p || p.running) return p;
  const rem = p.remainingMs > 0 ? p.remainingMs : p.minutes * 60000;
  return write({ ...p, running: true, endsAt: Date.now() + rem, remainingMs: rem, startedAt: p.startedAt || Date.now() });
}
// Reset: back to the full length, paused and ready. Dial count starts again on the next start.
export function resetPower() {
  const p = readPower();
  if (!p) return null;
  return write({ minutes: p.minutes, startedAt: null, running: false, endsAt: null, remainingMs: p.minutes * 60000 });
}
export function endPower() { write(null); }

export function fmtClock(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Calls a function every second while mounted; buzzes once when time runs out.
export function watchPower(onTick, timers) {
  let announced = false;
  const tick = () => {
    const p = readPower();
    onTick(p, remainingMs(p));
    if (p && p.running && remainingMs(p) === 0 && !announced) { announced = true; buzz([200, 100, 200]); }
  };
  tick();
  timers.push(setInterval(tick, 500));
}
