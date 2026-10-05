// DOM + date helpers
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// ---- dates (local, as YYYY-MM-DD strings) ----
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => ymd(new Date());
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const weekdayOf = (s) => parseYmd(s).getDay(); // 0 = Sun
export const isWeekend = (s) => { const w = weekdayOf(s); return w === 0 || w === 6; };
export const mondayOf = (s) => { const d = parseYmd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
export const diffDays = (a, b) => Math.round((parseYmd(a) - parseYmd(b)) / 864e5);
export const tsToYmd = (ts) => ymd(new Date(ts));
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dowName = (i, full) => (full ? DOW_FULL : DOW)[i];
export function fmtDate(s) {
  if (!s) return '—';
  const d = parseYmd(s);
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}
export function fmtRelative(s) {
  if (!s) return '—';
  const n = diffDays(s, today());
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n}d overdue`;
  return fmtDate(s);
}
export function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function firstName(name) { return (name || '').trim().split(/\s+/)[0] || ''; }
export function pluralise(n, one, many) { return `${n} ${n === 1 ? one : many || one + 's'}`; }
export function wordCount(s) { return (s.match(/\S+/g) || []).length; }

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buzz(ms = 25) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* ignore */ } }

export function pref(key, value) {
  try {
    if (value === undefined) return localStorage.getItem('outbound.' + key);
    if (value === null) localStorage.removeItem('outbound.' + key);
    else localStorage.setItem('outbound.' + key, value);
  } catch (e) { /* storage blocked */ }
  return value === undefined ? null : value;
}
