// The <video> element, HLS support, and the half-hour "broadcast schedule" that every
// list-based channel (archive.org, your drives, Jellyfin, custom streams) airs through.
import { $, esc, one, hash, daySeed, slotNow, loadScript } from './util.js';
import { settings, state } from './store.js';
import { toEnglish } from './translate.js';
import { staticOn, staticOff, msg, hideMsg, banner, scene, clearScene, bars } from './osd.js';

export const v = $('#vid');
let hls = null, session = null, watchdog = 0;
const HLS_JS = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js';

export function applyVolume() {
  v.volume = settings.vol; v.muted = settings.muted;
  state.hooks.ytVolume?.();
}

// session: { url, seek, seekRandom, clipLen, onPlaying, onEnded, onError, onBlocked }
export async function playUrl(sess) {
  stopVideo();
  session = sess;
  const isHls = sess.hls || /\.m3u8(\?|$)/i.test(sess.url);
  if (isHls && !v.canPlayType('application/vnd.apple.mpegurl')) {
    try { await loadScript(HLS_JS); } catch { if (session === sess) sess.onError?.(); return; }
    if (session !== sess) return;
    hls = new window.Hls({ maxBufferLength: 20 });
    hls.on(window.Hls.Events.ERROR, (e, d) => { if (d.fatal && session === sess) sess.onError?.(); });
    hls.loadSource(sess.url); hls.attachMedia(v);
  } else {
    v.src = sess.url;
  }
  v.hidden = false; applyVolume();
  clearTimeout(watchdog);
  watchdog = setTimeout(() => { if (session === sess && !sess.started) sess.onError?.(); }, sess.timeout || 25000);
  v.play().catch(e => { if (session === sess && e && e.name === 'NotAllowedError') { clearTimeout(watchdog); sess.onBlocked?.(); } });
}
export function stopVideo() {
  clearTimeout(watchdog);
  session = null;
  if (hls) { try { hls.destroy(); } catch {} hls = null; }
  clearSubs();
  v.pause(); v.removeAttribute('src'); v.load();
}

/* ---------- subtitles (CC button): .srt/.vtt from archive.org, the Bridge or Jellyfin ---------- */
let subUrl = '';
function clearSubs() {
  v.querySelectorAll('track').forEach(t => t.remove());
  if (subUrl) { URL.revokeObjectURL(subUrl); subUrl = ''; }
}
const srtToVtt = t => 'WEBVTT\n\n' + t.replace(/\r/g, '').replace(/^\uFEFF/, '').replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
// Shows or hides the current program's subtitles; returns whether it has any.
export async function applySubs() {
  const c = cur; clearSubs();
  const s = c && (c.p.groups[c.g][c.fi].sub || (c.p.subs && c.p.subs[0]));
  if (!s) return false;
  if (!settings.cc) return true;
  try {
    let txt = await (await fetch(s.url)).text();
    if (!/^\s*WEBVTT/.test(txt.replace(/^\uFEFF/, ''))) txt = srtToVtt(txt);
    if (cur !== c || !settings.cc) return true;
    subUrl = URL.createObjectURL(new Blob([txt], { type: 'text/vtt' }));
    const tr = document.createElement('track');
    Object.assign(tr, { kind: 'subtitles', label: 'CC', srclang: s.lang || 'en', src: subUrl, default: true });
    v.appendChild(tr);
    tr.track.mode = 'showing';
  } catch {}
  return true;
}
export const hasSubs = () => !!(cur && (cur.p.groups[cur.g][cur.fi].sub || (cur.p.subs && cur.p.subs.length)));
export const currentSession = () => session;

v.addEventListener('loadedmetadata', () => {
  const s = session; if (!s) return;
  const d = v.duration;
  if (isFinite(d) && d > 0) {
    if (s.seekRandom && d > 90) v.currentTime = Math.random() * (d - 75);
    else if (s.seek > 0) v.currentTime = Math.min(s.seek % d, Math.max(0, d - 3));
  }
  s.seek = 0;
});
v.addEventListener('playing', () => { const s = session; if (!s) return; s.started = true; clearTimeout(watchdog); s.onPlaying?.(); });
v.addEventListener('ended', () => { if (session?.resumeKey) setResume(session.resumeKey, 0); session?.onEnded?.(); });
v.addEventListener('error', () => { if (session && v.getAttribute('src')) session.onError?.(); });
// Resume: local media picked from the library remembers where you stopped.
const RKEY = 'nv.resume';
export function resumeAt(key) { try { return (JSON.parse(localStorage.getItem(RKEY) || '{}')[key] || 0); } catch { return 0; } }
function setResume(key, t) {
  try {
    const m = JSON.parse(localStorage.getItem(RKEY) || '{}');
    if (t) m[key] = Math.floor(t); else delete m[key];
    const keys = Object.keys(m); if (keys.length > 500) delete m[keys[0]];
    localStorage.setItem(RKEY, JSON.stringify(m));
  } catch {}
}
let lastResumeSave = 0;
v.addEventListener('timeupdate', () => {
  const s = session; if (!s) return;
  if (s.resumeKey && Date.now() - lastResumeSave > 5000 && v.currentTime > 10) {
    lastResumeSave = Date.now();
    setResume(s.resumeKey, isFinite(v.duration) && v.duration - v.currentTime < 60 ? 0 : v.currentTime);
  }
  if (!s.clipLen) return;
  if (s.clipStart == null) s.clipStart = v.currentTime;
  if (v.currentTime - s.clipStart >= s.clipLen) { const f = s.onEnded; s.onEnded = null; f?.(); }
});

// Tap-to-play fallback for browsers that block autoplay with sound.
export function blockedPrompt() {
  staticOff();
  msg('▶', 'Tap the screen to watch', { tap: true, onTap: () => { hideMsg(); v.play().catch(() => {}); } });
}

/* ================= broadcast schedule ================= */
// A "program" is resolved into { kind:'video'|'audio', groups:[[{url,len,title,hls}]], title, sub, art, desc, link }.
// groups are alternative encodings; if one won't decode we try the next.
export let cur = null;
let breakHook = null;
export const setBreakHook = f => { breakHook = f; };

export async function airList(ch, list, resolve, token, opts = {}) {
  const { slot, elapsed } = slotNow();
  // fromStart: tapes and on-demand picks play from the top instead of joining the schedule mid-show
  return airFrom(ch, list, resolve, opts.fromStart ? 0 : slot, opts.fromStart ? 0 : elapsed, token, opts);
}
async function airFrom(ch, list, resolve, idx, offset, token, opts) {
  for (let a = 0; a < 8; a++) {
    const entry = list[((idx + a) % list.length + list.length) % list.length];
    let p = null; try { p = await resolve(entry); } catch {}
    if (token !== state.token) return;
    if (p && p.groups && p.groups.length && p.groups[0].length) return start(ch, list, resolve, idx + a, p, a ? 0 : offset, token, opts);
  }
  bars('TECHNICAL DIFFICULTIES', 'PLEASE STAND BY');
}
function start(ch, list, resolve, listIdx, p, offset, token, opts) {
  const files = p.groups[0]; let fi = 0, off = offset;
  if (off > 0) {
    if (p.kind === 'video' && files.length > 1) {
      fi = hash(daySeed(), ch.n, listIdx) % files.length; const L = files[fi].len; if (L) off %= L;
    } else {
      const lenOf = f => f.len || 240, total = files.reduce((s, f) => s + lenOf(f), 0); off %= total;
      while (fi < files.length - 1 && off > lenOf(files[fi])) { off -= lenOf(files[fi]); fi++; }
    }
  }
  cur = { ch, list, resolve, listIdx, p, g: 0, fi, token, startOff: off, opts, bannered: false };
  loadFile();
}
function showAudioScene() {
  const c = cur, f = c.p.groups[c.g][c.fi];
  if (c.p.kind !== 'audio' || c.opts.bg) return;
  scene(`<div class="aud">${c.p.art ? `<img class="aud-art" src="${esc(c.p.art)}" alt="" onerror="this.style.visibility='hidden'">` : '<div class="aud-art"></div>'}
    <div class="eq">${'<i></i>'.repeat(14)}</div><div class="aud-title">${esc(c.p.title)}</div>
    <div class="aud-track">${esc(c.p.groups[c.g].length > 1 ? '♪ ' + f.title : (c.p.sub || ''))}</div></div>`, 'radio');
}
function loadFile() {
  const c = cur, f = c.p.groups[c.g][c.fi];
  if (c.p.kind === 'audio' && !c.opts.bg) { v.hidden = true; showAudioScene(); }
  else if (!c.opts.bg) clearScene();
  playUrl({
    url: f.url, hls: f.hls, seek: c.opts.resume ? (c.startOff || resumeAt(f.url.replace(/[?&](t|api_key)=[^&]*/g, ''))) : c.startOff,
    resumeKey: c.opts.resume ? f.url.replace(/[?&](t|api_key)=[^&]*/g, '') : null,
    onPlaying: () => {
      if (cur !== c) return;
      c.startOff = 0; staticOff(); hideMsg();
      if (c.p.kind === 'audio' && !c.opts.bg) v.hidden = true;
      if (!c.bannered && !c.opts.bg) { c.bannered = true; showProgramBanner(); }
    },
    onEnded: () => { if (cur !== c) return; if (c.fi < c.p.groups[c.g].length - 1) { c.fi++; c.startOff = 0; loadFile(); } else skip(); },
    onError: () => {
      if (cur !== c) return;
      if (c.g < c.p.groups.length - 1) { c.g++; c.fi = Math.min(c.fi, c.p.groups[c.g].length - 1); loadFile(); } else skip();
    },
    onBlocked: blockedPrompt,
  });
  applySubs();
}
export function skip() {
  const c = cur; if (!c || c.token !== state.token) return;
  cur = null; stopVideo(); if (!c.opts.bg) staticOn();
  airFrom(c.ch, c.list, c.resolve, c.listIdx + 1, 0, c.token, c.opts);
}
export function stopProgram() { cur = null; stopVideo(); v.hidden = false; }

// What's on right now, in a form that can be saved to a VCR tape.
export function currentEntry() {
  if (!cur) return null;
  const e = cur.list[((cur.listIdx % cur.list.length) + cur.list.length) % cur.list.length];
  return { entry: e, title: cur.p.title, url: cur.p.groups[cur.g][cur.fi].url, kind: cur.p.kind, at: v.currentTime || 0 };
}
export function programInfo() {
  if (!cur) return null;
  const files = cur.p.groups[cur.g];
  return {
    title: cur.p.title, desc: cur.p.desc, link: cur.p.link,
    sub: [cur.p.sub, files.length > 1 ? files[cur.fi].title : ''].filter(Boolean).join(' · '),
  };
}
export function showProgramBanner(ms) {
  const i = programInfo(); if (!i) return;
  banner({ ch: cur.ch, title: i.title, sub: i.sub }, ms);
  const c = cur;
  toEnglish(i.title).then(t => { const el = $('#banner .b-title'); if (t.from && cur === c && el) el.textContent = t.text; });
}

// Commercial-break support: freeze the program and hand back a resume function.
export function suspendProgram() {
  if (!cur || cur.opts.bg || cur.p.kind !== 'video') return null;
  const c = cur, at = v.currentTime;
  cur = null; stopVideo();
  return () => {
    if (c.token !== state.token) return;
    cur = c; c.startOff = at; c.bannered = true;
    loadFile();
  };
}

// Track program watch-time for commercial breaks.
let lastTick = Date.now(), watched = 0;
setInterval(() => {
  const now = Date.now(), dt = now - lastTick; lastTick = now;
  if (!cur || !state.on || state.inBreak || v.paused || cur.opts.bg || cur.p.kind !== 'video') return;
  watched += dt;
  if (settings.ads && watched >= settings.adEvery * 60000 && breakHook) { watched = 0; breakHook(); }
}, 1000);
