// The classic remote extras: SLEEP timer, CC, picture-in-picture, favorites, and the VCR (REC + tape shelf).
import { $, esc, slotNow } from './util.js';
import { settings, save, state } from './store.js';
import { CHANNELS, chanByNum, isHidden } from './lineup.js';
import { osdChan, scene, staticOff, staticOn, msg, banner } from './osd.js';
import { currentEntry, airList, v, applySubs } from './player.js';
import { ytActive, ytNow, ytCaptions, tuneYouTube } from './sources/youtube.js';
import { getList, resolveItem } from './sources/archive.js';
import { tuneStream } from './sources/local.js';
import { iconSVG } from './icons.js';

/* ---------- SLEEP ---------- */
const SLEEP_STEPS = [15, 30, 60, 90, 120, 0];
export function sleepButton() {
  const left = state.sleepAt ? Math.ceil((state.sleepAt - Date.now()) / 60000) : 0;
  const next = SLEEP_STEPS.find(m => m > left) ?? 0;
  state.sleepAt = next ? Date.now() + next * 60000 : 0;
  osdChan(null, next ? `SLEEP ${next}` : 'SLEEP OFF');
}
setInterval(() => {
  if (!state.on || !state.sleepAt) return;
  const left = state.sleepAt - Date.now();
  if (left <= 60000 && left > 59000) osdChan(null, 'SLEEP 1');
  if (left <= 0) { state.sleepAt = 0; state.hooks.power?.(); }
}, 1000);

/* ---------- CC ---------- */
export function ccButton() {
  settings.cc = !settings.cc; save();
  if (ytActive()) { ytCaptions(); osdChan(null, settings.cc ? 'CC ON' : 'CC OFF'); return; }
  osdChan(null, settings.cc ? 'CC ON' : 'CC OFF');
  // archive.org, the Bridge and Jellyfin: subtitle files when the show has them
  applySubs().then(has => { if (settings.cc && !has) setTimeout(() => osdChan(null, 'CC: none for this show'), 1400); });
}

/* ---------- favorites ---------- */
export function favToggle() {
  const n = state.num, f = settings.favorites || (settings.favorites = []);
  const i = f.indexOf(n);
  if (i >= 0) f.splice(i, 1); else f.push(n);
  f.sort((a, b) => a - b); save();
  osdChan(null, i >= 0 ? '★ REMOVED' : '★ FAVORITE');
}
export function favNext() {
  const f = (settings.favorites || []).filter(n => chanByNum(n) && !isHidden(n));
  if (!f.length) { osdChan(null, 'NO FAVORITES'); setTimeout(() => osdChan(null, 'FAV+ ADDS ONE'), 1500); return; }
  const n = f.find(x => x > state.num) ?? f[0];
  state.hooks.tune(n);
}

/* ---------- picture-in-picture ---------- */
let pipOn = false;
export const pipActive = () => pipOn;
export function pipButton() { pipOn = !pipOn; if (pipOn) pipRender(); else pipClose(); }
export function pipSwap() { if (pipOn && state.prev != null) state.hooks.tune(state.prev); }
export function pipClose() { pipOn = false; const p = $('#pip'); p.innerHTML = ''; p.hidden = true; }
export async function pipRender() {
  if (!pipOn) return;
  const ch = chanByNum(state.prev ?? -1), p = $('#pip');
  p.hidden = false;
  if (!ch) { p.innerHTML = `<div class="pip-card">PIP<small>Change channel once to pick the PIP channel</small></div>`; return; }
  const label = `<b class="pip-n">${ch.n} ${esc(ch.call)}</b>`;
  const embed = src => `<iframe src="${src}" allow="autoplay; encrypted-media"></iframe>${label}`;
  const id = ch.yt && ch.yt[0];
  if (ch.kind === 'ytlive') p.innerHTML = embed(`https://www.youtube.com/embed/live_stream?channel=${ch.channelId}&autoplay=1&mute=1&controls=0`);
  else if (ch.kind === 'yt' && id && /^(UC|PL|UU)/.test(id)) p.innerHTML = embed(`https://www.youtube.com/embed/videoseries?list=${id.startsWith('UC') ? 'UU' + id.slice(2) : id}&autoplay=1&mute=1&controls=0`);
  else if (ch.kind === 'archive') {
    p.innerHTML = `<div class="pip-card">${iconSVG(ch)}</div>${label}`;
    try {
      const list = await getList(ch), { slot, elapsed } = slotNow(), item = list[slot % list.length];
      const prog = await resolveItem(item); if (!pipOn || !prog || prog.kind !== 'video') return;
      p.innerHTML = `<video muted autoplay playsinline src="${prog.groups[0][0].url}"></video>${label}`;
      const pv = p.querySelector('video'); pv.addEventListener('loadedmetadata', () => { if (isFinite(pv.duration)) pv.currentTime = elapsed % pv.duration; }, { once: true });
    } catch {}
  } else p.innerHTML = `<div class="pip-card">${iconSVG(ch)}<small>${esc(ch.name)}</small></div>${label}`;
}

/* ---------- VCR: REC saves what's on; channel 880 is the tape shelf ---------- */
export function recButton() {
  const ch = chanByNum(state.num); if (!ch) return;
  let tape = null;
  if (ytActive()) { const y = ytNow(); if (y) tape = { label: y.title, ref: { type: 'yt', id: y.id } }; }
  else {
    const c = currentEntry();
    if (c && c.entry && c.entry.identifier) tape = { label: c.title, ref: { type: 'archive', id: c.entry.identifier } };
    else if (c) tape = { label: c.title, ref: { type: 'url', url: c.url, audio: c.kind === 'audio' } };
  }
  if (!tape) { osdChan(null, 'NOTHING TO TAPE'); return; }
  tape.ch = ch.n; tape.date = new Date().toISOString().slice(0, 10);
  settings.tapes = [tape, ...(settings.tapes || []).filter(t => JSON.stringify(t.ref) !== JSON.stringify(tape.ref))].slice(0, 60);
  save();
  osdChan(null, '● REC');
  $('#recDot').hidden = false; setTimeout(() => { $('#recDot').hidden = true; }, 3500);
}
const vcr = { open: false, sel: 0, playing: false };
export const vcrState = vcr;
export function tuneVCR(ch, token) {
  vcr.open = true; vcr.playing = false; vcr.ch = ch; vcr.token = token; vcr.sel = 0;
  staticOff(); renderShelf();
}
function renderShelf() {
  const tapes = settings.tapes || [];
  $('#prog').classList.remove('vhs');
  scene(`<div class="vcr-shelf"><div class="vcr-head">📼 VCR · TAPE SHELF<small>${tapes.length ? '▲▼ choose · OK play · BACK eject' : 'Press REC on the remote to tape whatever is on.'}</small></div>
    <div class="tapes">${tapes.map((t, i) => `<div class="tape${i === vcr.sel ? ' sel' : ''}" data-i="${i}"><span class="tape-label">${esc(t.label)}</span><span class="tape-meta">CH ${t.ch} · ${t.date}</span></div>`).join('')}</div></div>`, 'vcrscene');
  const list = document.querySelector('.tapes');
  if (list) { list.onclick = e => { const t = e.target.closest('.tape'); if (t) { vcr.sel = +t.dataset.i; vcrOK(); } }; list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' }); }
}
export function vcrNav(d) { if (!vcr.open || vcr.playing) return false; const n = (settings.tapes || []).length; if (!n) return true; vcr.sel = (vcr.sel + d + n) % n; renderShelf(); return true; }
export function vcrOK() {
  if (!vcr.open || vcr.playing) return false;
  const t = (settings.tapes || [])[vcr.sel]; if (!t) return true;
  vcr.playing = true; staticOn();
  $('#prog').classList.add('vhs');
  osdChan(null, 'PLAY ▶');
  const ch = { ...vcr.ch, name: t.label }, token = state.token;
  if (t.ref.type === 'yt') tuneYouTube({ ...ch, kind: 'yt', yt: [t.ref.id] }, token);
  else if (t.ref.type === 'archive') airList(ch, [{ identifier: t.ref.id }], resolveItem, token, { fromStart: true });
  else tuneStream({ ...ch, url: t.ref.url, audio: t.ref.audio }, token);
  return true;
}
export function vcrBack() {
  if (!vcr.open) return false;
  if (vcr.playing) { vcr.playing = false; state.hooks.tune(vcr.ch.n); return true; }
  return false;
}
export function leaveVCR() { vcr.open = false; vcr.playing = false; $('#prog').classList.remove('vhs'); }
