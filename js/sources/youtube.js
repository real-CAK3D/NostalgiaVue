// YouTube channels. Three ways a channel can be programmed:
//   yt: [ids]      channel IDs (UC… -> uploads playlist), playlist IDs, or video IDs; tried in order,
//                  or rotated every half hour when mix:true
//   search: {...}  YouTube Data API search (needs the free API key in MENU › Sources), which also
//                  gives titles for the ON DEMAND picker (OK button)
//   q: [...]       archive.org fallback when YouTube has nothing
import { $, esc, hash, daySeed, slotNow, loadScript, fetchJSON } from '../util.js';
import { settings, save, state } from '../store.js';
import { staticOn, staticOff, hideMsg, msg, banner, scene, clearScene } from '../osd.js';
import { tuneArchive } from './archive.js';

const yt = { player: null, ready: false, ch: null, cands: [], cand: 0, errs: 0, token: 0, playing: false, lastVid: '', watchdog: 0, items: null, picker: null };

function api() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  return new Promise((res, rej) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(); };
    loadScript('https://www.youtube.com/iframe_api').catch(rej);
  });
}
const listFor = id => id.startsWith('UC') ? 'UU' + id.slice(2) : id;
const isVideo = id => /^[A-Za-z0-9_-]{11}$/.test(id);

export function ytVolume() {
  if (!yt.player || !yt.ready) return;
  try { yt.player.setVolume(Math.round(settings.vol * 100)); settings.muted ? yt.player.mute() : yt.player.unMute(); } catch {}
}
state.hooks.ytVolume = ytVolume;

/* ---------- YouTube Data API (optional) ---------- */
const DAY_KEY = 'nv.ytcache.' + daySeed();
let cache; try { cache = JSON.parse(localStorage.getItem(DAY_KEY) || '{}'); } catch { cache = {}; }
// drop older days' caches
try { Object.keys(localStorage).filter(k => k.startsWith('nv.ytcache.') && k !== DAY_KEY).forEach(k => localStorage.removeItem(k)); } catch {}
const keep = () => { try { localStorage.setItem(DAY_KEY, JSON.stringify(cache)); } catch {} };
// A key typed into MENU › Sources is used directly; otherwise the site's own /api/yt proxy
// (key stored privately on Vercel) is used when it's set up.
let serverKey = null;
const serverReady = () => serverKey ?? (serverKey = fetch('api/yt?op=ping').then(r => r.ok).catch(() => false));
export const hasKey = () => !!settings.ytKey || serverKey === true;
async function ytApi(op, params) {
  if (settings.ytKey) {
    const path = op === 'search' ? 'search' : 'channels';
    const p = new URLSearchParams({ ...params, key: settings.ytKey });
    return fetchJSON(`https://www.googleapis.com/youtube/v3/${path}?${p}`);
  }
  if (!(await serverReady())) throw new Error('no YouTube key');
  return fetchJSON(`api/yt?${new URLSearchParams({ op, ...params })}`);
}
serverReady().then(ok => { serverKey = ok; });

async function apiSearch(q, { channelId, long } = {}) {
  const k = `s|${q}|${channelId || ''}|${long ? 1 : 0}`;
  if (cache[k]) return cache[k];
  const p = { part: 'snippet', type: 'video', maxResults: '50', q, videoEmbeddable: 'true' };
  if (channelId) p.channelId = channelId;
  if (long) p.videoDuration = 'long';
  const j = await ytApi('search', p);
  const items = (j.items || []).filter(i => i.id && i.id.videoId).map(i => ({ id: i.id.videoId, title: decode(i.snippet.title), by: decode(i.snippet.channelTitle) }));
  cache[k] = items; keep();
  return items;
}
function decode(s) { const t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; }

// @handle -> UC… channel ID (needs the API key)
export async function resolveHandle(handle) {
  const h = handle.replace(/^.*\/(@[^/?#]+).*$/, '$1');
  const j = await ytApi('channels', { part: 'id,snippet', forHandle: h.startsWith('@') ? h : '@' + h });
  const c = j.items && j.items[0];
  return c ? { id: c.id, name: c.snippet.title } : null;
}

async function searchItems(ch) {
  const s = ch.search; if (!s) return null;
  if (!settings.ytKey && !(await serverReady())) return null;
  const qs = typeof s.q === 'function' ? s.q() : [].concat(s.q);
  const { slot } = slotNow();
  // rotate which query airs each half hour; channel-restricted searches merge their results
  const q = qs[hash(daySeed(), ch.n, slot) % qs.length];
  const lists = await Promise.all((s.channels && s.channels.length ? s.channels : [null]).map(c => apiSearch(q, { channelId: c, long: s.long }).catch(() => [])));
  const seen = new Set(), out = [];
  for (const l of lists) for (const it of l) if (!seen.has(it.id)) { seen.add(it.id); out.push(it); }
  return out.length ? out : null;
}

/* ---------- tuning ---------- */
export async function tuneYouTube(ch, token) {
  try { await api(); }
  catch { if (token === state.token) return fallback(ch, token, 'Can’t reach YouTube'); return; }
  if (token !== state.token) return;
  let items = null;
  try { items = await searchItems(ch); } catch {}
  if (token !== state.token) return;
  const ids = ch.yt || [];
  if (!items && !ids.length) return fallback(ch, token, 'Add a YouTube API key in MENU › Sources to program this channel');
  const { slot } = slotNow();
  const start = ch.mix && ids.length ? hash(daySeed(), ch.n, slot) % ids.length : 0;
  Object.assign(yt, { ch, cands: ids.slice(start).concat(ids.slice(0, start)), cand: 0, errs: 0, token, playing: false, lastVid: '', items });
  $('#yt').hidden = false;
  if (!yt.player) {
    yt.player = new YT.Player('ytMount', {
      width: '100%', height: '100%',
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0 },
      events: { onReady: () => { yt.ready = true; ytVolume(); if (yt.token === state.token && yt.ch) load(); }, onStateChange, onError },
    });
  } else if (yt.ready) load();
}
function arm() {
  clearTimeout(yt.watchdog);
  yt.watchdog = setTimeout(() => { if (yt.token === state.token && yt.ch && !yt.playing) fail(); }, 20000);
}
function load(pick) {
  const { slot, elapsed } = slotNow();
  yt.playing = false;
  if (yt.items) {
    const ids = yt.items.map(i => i.id);
    const index = pick ?? hash(daySeed(), yt.ch.n, slot) % ids.length;
    yt.player.loadPlaylist({ playlist: ids, index, startSeconds: pick != null ? 0 : Math.floor(elapsed % 300) });
  } else {
    const id = yt.cands[yt.cand];
    if (isVideo(id)) yt.player.loadVideoById({ videoId: id, startSeconds: 0 });
    // uploads are newest-first; each half hour airs a different spot in the first 150
    else yt.player.loadPlaylist({ list: listFor(id), listType: 'playlist', index: hash(daySeed(), yt.ch.n, slot) % (id.startsWith('PL') ? 25 : 150), startSeconds: Math.floor(elapsed % 120) });
  }
  ytVolume(); arm();
}
function onStateChange(e) {
  if (yt.token !== state.token || !yt.ch) return;
  if (e.data === YT.PlayerState.PLAYING) {
    yt.errs = 0; clearTimeout(yt.watchdog); staticOff(); hideMsg();
    const d = yt.player.getVideoData();
    learnName(d.author);
    if (!yt.playing || d.video_id !== yt.lastVid) {
      yt.lastVid = d.video_id;
      banner({ ch: yt.ch, title: d.title || yt.ch.name, sub: [d.author, 'YouTube', yt.items ? 'Press OK for ON DEMAND' : ''].filter(Boolean).join(' · ') });
    }
    yt.playing = true;
  }
}
// Channels added by ID alone get their real name the first time they air.
function learnName(author) {
  const ch = yt.ch; if (!ch || !author || ch.mix || ch.search) return;
  const id = yt.cands[yt.cand]; if (!id) return;
  settings.ytNames = settings.ytNames || {};
  if (settings.ytNames[id] !== author) { settings.ytNames[id] = author; save(); state.hooks.namesLearned?.(); }
}
function onError() {
  if (yt.token !== state.token || !yt.ch) return;
  if (++yt.errs < 6) { staticOn(); yt.playing = false; yt.player.nextVideo(); arm(); return; } // 101/150: embedding off, hop on
  fail();
}
function fail() {
  if (yt.ch && yt.items) { yt.items = null; yt.errs = 0; if (yt.cands.length) { load(); return; } }
  else if (yt.ch && yt.cand < yt.cands.length - 1) { yt.cand++; yt.errs = 0; load(); return; }
  const ch = yt.ch, token = yt.token; stopYouTube();
  fallback(ch, token, 'This YouTube channel isn’t broadcasting');
}
function fallback(ch, token, why) {
  if (ch && ch.q && ch.q.length) return tuneArchive({ ...ch, kind: 'archive' }, token);
  if (ch && ch.url) return state.hooks.card?.(ch);
  staticOn(); msg('NO SIGNAL', why);
}
export function stopYouTube() {
  clearTimeout(yt.watchdog); closePicker();
  yt.ch = null; yt.items = null; $('#yt').hidden = true;
  if (yt.player && yt.ready) try { yt.player.stopVideo(); } catch {}
}
export function title() { try { return yt.player.getVideoData().title; } catch { return ''; } }
export function ytUrl() { try { return yt.player.getVideoUrl(); } catch { return ''; } }
export const ytActive = () => !!yt.ch;

/* ---------- ON DEMAND picker (curated search lists) ---------- */
export const pickerOpen = () => !!yt.picker;
export function openPicker() {
  if (!yt.ch || !yt.items) return false;
  let cur = 0; try { cur = yt.player.getPlaylistIndex(); } catch {}
  yt.picker = { sel: Math.max(0, cur) };
  renderPicker(); return true;
}
function renderPicker() {
  const p = yt.picker; if (!p) return;
  scene(`<div class="ondemand"><div class="od-head">ON DEMAND · ${esc(yt.ch.name)}<small>▲▼ choose · OK watch · BACK close</small></div>
    <div class="od-list">${yt.items.map((it, i) => `<div class="od-item${i === p.sel ? ' sel' : ''}" data-i="${i}"><b>${esc(it.title)}</b><small>${esc(it.by)}</small></div>`).join('')}</div></div>`, 'odscene');
  const list = document.querySelector('.od-list');
  list.onclick = e => { const it = e.target.closest('.od-item'); if (it) { p.sel = +it.dataset.i; pickerOK(); } };
  list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
}
export function pickerNav(d) { const p = yt.picker; if (!p) return false; p.sel = (p.sel + d + yt.items.length) % yt.items.length; renderPicker(); return true; }
export function pickerOK() { const p = yt.picker; if (!p) return false; const i = p.sel; closePicker(); staticOn(); load(i); return true; }
export function closePicker() { if (!yt.picker) return false; yt.picker = null; clearScene(); return true; }

// Accepts a channel URL, /channel/UC…, playlist link, video link, or raw ID.
export function parseYouTube(s) {
  s = String(s).trim();
  let m = s.match(/[?&]list=([A-Za-z0-9_-]{12,})/); if (m) return m[1];
  m = s.match(/channel\/(UC[A-Za-z0-9_-]{22})/); if (m) return m[1];
  m = s.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/); if (m) return m[1];
  m = s.match(/^(UC[A-Za-z0-9_-]{22}|UU[A-Za-z0-9_-]{22}|PL[A-Za-z0-9_-]{16,}|[A-Za-z0-9_-]{11})$/); if (m) return m[1];
  return null;
}
