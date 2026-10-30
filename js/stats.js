// Channel stats and ratings.
// On this device (always): minutes watched per channel and category, your star ratings.
// Shared (when the site's stats database is connected): how many TVs are watching each channel
// right now, the most-watched channels today and all time, and everyone's average rating.
// Shared stats are anonymous: a random id this TV made up, the channel number and its category.
import { settings, state } from './store.js';
import { chanByNum } from './lineup.js';

const KEY = 'nv.stats';
let mine; try { mine = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
if (!mine || typeof mine !== 'object') mine = {};
mine.ch ||= {}; mine.cat ||= {}; mine.days ||= {}; mine.rate ||= {}; mine.since ||= Date.now();
if (!mine.id) mine.id = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(mine)); } catch {} };

let shared = null;            // last summary from the server, or false when it isn't set up
let watchingHere = null;      // { ch, watching, total } from the last check-in
const listeners = new Set();
export const onStats = fn => listeners.add(fn);
const tell = () => listeners.forEach(fn => { try { fn(); } catch {} });

const sharing = () => settings.shareStats !== false && shared !== false;
async function post(body) {
  const r = await fetch('api/stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: mine.id, ...body }) });
  if (r.status === 503 || r.status === 404) { shared = false; return null; }
  return r.ok ? r.json() : null;
}

// every 15 s of the set being on (and the page visible) counts toward the channel on screen
const TICK = 15;
setInterval(() => {
  if (!state.on || document.hidden || !state.num) return;
  const ch = chanByNum(state.num); if (!ch) return;
  const d = new Date().toISOString().slice(0, 10);
  mine.ch[ch.n] = (mine.ch[ch.n] || 0) + TICK;
  mine.cat[ch.cat] = (mine.cat[ch.cat] || 0) + TICK;
  mine.days[d] = (mine.days[d] || 0) + TICK;
  const ds = Object.keys(mine.days).sort(); while (ds.length > 60) delete mine.days[ds.shift()];
  keep();
}, TICK * 1000);

// a check-in once a minute (and right after changing channels) for the shared counts
let beatTimer = 0;
async function beat() {
  clearTimeout(beatTimer); beatTimer = setTimeout(beat, 60000);
  if (!sharing() || !state.on || document.hidden || !state.num) return;
  const ch = chanByNum(state.num); if (!ch) return;
  try {
    const j = await post({ op: 'beat', ch: ch.n, cat: ch.cat || 'OTHER' });
    if (j) { watchingHere = { ch: ch.n, ...j }; tell(); }
  } catch {}
}
let changeTimer = 0;
export function channelChanged() { clearTimeout(changeTimer); changeTimer = setTimeout(beat, 4000); }
export function poweredOff() {
  watchingHere = null;
  if (sharing()) try { navigator.sendBeacon?.('api/stats', new Blob([JSON.stringify({ id: mine.id, op: 'leave' })], { type: 'application/json' })); } catch {}
}
beatTimer = setTimeout(beat, 8000);

// how many TVs are on this channel right now (counting this one), or null if unknown
export const watchingNow = n => watchingHere && watchingHere.ch === n ? watchingHere.watching : null;
export const watchingTotal = () => watchingHere ? watchingHere.total : null;

/* ---------- ratings ---------- */
export const myRating = n => mine.rate[n] || 0;
export function rate(n, stars) {
  stars = mine.rate[n] === stars ? 0 : stars;     // same star again clears it
  if (stars) mine.rate[n] = stars; else delete mine.rate[n];
  keep();
  if (sharing()) post({ op: 'rate', ch: n, stars }).then(() => { summaryAt = 0; }).catch(() => {});
  return stars;
}
export const starsHTML = (n, cls = '') => `<span class="stars ${cls}" data-rate="${n}">${[1, 2, 3, 4, 5].map(i => `<b data-star="${i}" class="${i <= myRating(n) ? 'on' : ''}">★</b>`).join('')}</span>`;

/* ---------- reading it back ---------- */
let summaryAt = 0;
export async function sharedSummary(force) {
  if (settings.shareStats === false) return null;
  if (shared === false) return null;
  if (!force && shared && Date.now() - summaryAt < 60000) return shared;
  try {
    const r = await fetch('api/stats');
    if (r.status === 503 || r.status === 404) { shared = false; return null; }
    if (!r.ok) return shared || null;
    shared = await r.json(); summaryAt = Date.now();
    return shared;
  } catch { return shared || null; }
}
export const myStats = () => mine;
export function resetMyStats() { mine = { id: mine.id, ch: {}, cat: {}, days: {}, rate: {}, since: Date.now() }; keep(); }
export const fmtMins = s => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
