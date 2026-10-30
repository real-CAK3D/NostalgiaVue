// Small shared helpers. No DOM state lives here.
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pad = n => String(n).padStart(2, '0');
export const one = v => Array.isArray(v) ? v[0] : v;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export const SLOT = 30 * 60 * 1000;

export function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffle(arr, seed) {
  const r = mulberry(seed), a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function hash(...xs) {
  let h = 2166136261;
  for (const x of xs) {
    if (typeof x === 'string') for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 16777619); }
    else { h ^= x | 0; h = Math.imul(h, 16777619); }
  }
  return h >>> 0;
}
export function dayStart(t = Date.now()) { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; }
export function daySeed() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
export function slotNow(t = Date.now()) {
  const m = dayStart(t), s = Math.floor((t - m) / SLOT), start = m + s * SLOT;
  return { slot: s, start, elapsed: (t - start) / 1000 };
}
export function fmtTime(t, h24) {
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !h24 });
}
export function stripHtml(s) {
  const d = document.createElement('div'); d.innerHTML = String(s || '');
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}
export function parseLen(l) {
  if (l == null) return 0; l = String(l);
  if (l.includes(':')) return l.split(':').reduce((a, b) => a * 60 + (parseFloat(b) || 0), 0);
  return parseFloat(l) || 0;
}
const scripts = new Map();
export function loadScript(src) {
  if (!scripts.has(src)) scripts.set(src, new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { scripts.delete(src); rej(new Error('load ' + src)); };
    document.head.appendChild(s);
  }));
  return scripts.get(src);
}
export async function fetchJSON(url, opts = {}, ms = 15000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (!r.ok) throw new Error(r.status + ' ' + url);
    return await r.json();
  } finally { clearTimeout(t); }
}
