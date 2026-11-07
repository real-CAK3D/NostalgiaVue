// Real-length scheduling, like a real TV listing. Every program takes as many half-hour blocks as it
// runs (a 22-minute sitcom = one block, a 47-minute drama = two, a 95-minute movie = four), laid end
// to end from midnight in the channel's order for the day. Lengths come from the source (archive.org's
// runtime, YouTube's duration, the Bridge, Jellyfin) or, once a program has aired, from the player;
// anything not known yet counts as one block. Learned lengths are kept on this device.
import { SLOT, slotNow, one } from './util.js';

const KEY = 'nv.lengths', BLOCK = SLOT / 1000;
let lens = {}; try { lens = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch {}
let saveT = 0;

export const entryKey = e => e && (e.identifier || e.path || e.Id || e.id || null);

export function learnLength(key, secs) {
  if (!key || !(secs > 60) || Math.abs((lens[key] || 0) - secs) < 30) return;
  lens[key] = Math.round(secs);
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const k = Object.keys(lens); if (k.length > 5000) k.slice(0, k.length - 5000).forEach(x => delete lens[x]);
    try { localStorage.setItem(KEY, JSON.stringify(lens)); } catch {}
  }, 2000);
}

// "1:23:45", "23:45", "93 min", "1h 33m", "PT1H33M", "5580" -> seconds
export function parseRuntime(r) {
  r = String(one(r) || '').trim(); if (!r) return 0;
  let m;
  if ((m = r.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i))) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  if ((m = r.match(/(\d+):(\d\d):(\d\d)/))) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  if ((m = r.match(/^(\d+):(\d\d)(?:\.\d+)?$/))) return +m[1] * 60 + +m[2];
  const h = r.match(/(\d+(?:\.\d+)?)\s*h/i), mi = r.match(/(\d+(?:\.\d+)?)\s*m(?!s)/i);
  if (h || mi) return (h ? +h[1] * 3600 : 0) + (mi ? +mi[1] * 60 : 0);
  if ((m = r.match(/^(\d+(?:\.\d+)?)$/))) return +m[1] > 400 ? +m[1] : +m[1] * 60;
  return 0;
}

export function lengthOf(e) {
  if (!e) return 0;
  const k = entryKey(e);
  if (k && lens[k]) return lens[k];
  return +e.len || +e.dur || (e.RunTimeTicks ? e.RunTimeTicks / 1e7 : 0) || parseRuntime(e.runtime) || 0;
}
// up to two minutes over still fits (closing credits run under the next show's open); 6 hours max
export const blocksFor = secs => Math.max(1, Math.min(12, Math.ceil((secs - 120) / BLOCK)));

// The program airing in half-hour slot `slot` of today: { idx, startSlot, blocks }.
// idx can run past the list's end; callers wrap it.
export function locate(list, slot) {
  if (!list || !list.length) return { idx: slot, startSlot: slot, blocks: 1 };
  let s = 0;
  for (let i = 0; i < 400; i++) {
    const b = blocksFor(lengthOf(list[i % list.length]));
    if (s + b > slot) return { idx: i, startSlot: s, blocks: b };
    s += b;
  }
  return { idx: slot, startSlot: slot, blocks: 1 };
}
// What's on right now: list index, seconds into it, and when it started and ends.
export function onNow(list, t = Date.now()) {
  const { slot, start, elapsed } = slotNow(t), at = locate(list, slot);
  const startTime = start - (slot - at.startSlot) * SLOT;
  return { ...at, offset: (slot - at.startSlot) * BLOCK + elapsed, startTime, endTime: startTime + at.blocks * SLOT };
}
