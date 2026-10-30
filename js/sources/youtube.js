// YouTube channels play their uploads playlist (UC… -> UU…) through the IFrame API.
import { $, hash, daySeed, slotNow, loadScript } from '../util.js';
import { settings, state } from '../store.js';
import { staticOn, staticOff, hideMsg, msg, bars, banner } from '../osd.js';
import { tuneArchive } from './archive.js';

const yt = { player: null, ready: false, ch: null, cand: 0, errs: 0, token: 0, playing: false, lastVid: '', watchdog: 0 };

function api() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  return new Promise((res, rej) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(); };
    loadScript('https://www.youtube.com/iframe_api').catch(rej);
  });
}
const listFor = id => id.startsWith('UC') ? 'UU' + id.slice(2) : id;

export function ytVolume() {
  if (!yt.player || !yt.ready) return;
  try { yt.player.setVolume(Math.round(settings.vol * 100)); settings.muted ? yt.player.mute() : yt.player.unMute(); } catch {}
}
state.hooks.ytVolume = ytVolume;

export async function tuneYouTube(ch, token) {
  try { await api(); }
  catch { if (token === state.token) return fallback(ch, token, 'Can’t reach YouTube'); return; }
  if (token !== state.token) return;
  Object.assign(yt, { ch, cand: 0, errs: 0, token, playing: false, lastVid: '' });
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
function load() {
  const { slot, elapsed } = slotNow(), id = yt.ch.yt[yt.cand];
  // uploads are newest-first; each half hour airs a different spot in the first 150
  const index = hash(daySeed(), yt.ch.n, slot) % 150;
  yt.playing = false;
  if (/^[A-Za-z0-9_-]{11}$/.test(id)) yt.player.loadVideoById({ videoId: id, startSeconds: 0 });
  else yt.player.loadPlaylist({ list: listFor(id), listType: 'playlist', index, startSeconds: Math.floor(elapsed % 120) });
  ytVolume(); arm();
}
function onStateChange(e) {
  if (yt.token !== state.token || !yt.ch) return;
  if (e.data === YT.PlayerState.PLAYING) {
    yt.errs = 0; clearTimeout(yt.watchdog); staticOff(); hideMsg();
    const vid = yt.player.getVideoData().video_id;
    if (!yt.playing || vid !== yt.lastVid) { yt.lastVid = vid; banner({ ch: yt.ch, title: title() || yt.ch.name, sub: `${yt.ch.name} · YouTube` }); }
    yt.playing = true;
  }
}
function onError() {
  if (yt.token !== state.token || !yt.ch) return;
  if (++yt.errs < 6) { staticOn(); yt.playing = false; yt.player.nextVideo(); arm(); return; } // 101/150: embedding off, hop on
  fail();
}
function fail() {
  if (yt.ch && yt.cand < yt.ch.yt.length - 1) { yt.cand++; yt.errs = 0; load(); return; }
  const ch = yt.ch, token = yt.token; stopYouTube();
  fallback(ch, token, 'This YouTube channel isn’t broadcasting');
}
function fallback(ch, token, why) {
  if (ch && ch.q && ch.q.length) return tuneArchive({ ...ch, kind: 'archive' }, token);
  staticOn(); msg('NO SIGNAL', why);
}
export function stopYouTube() {
  clearTimeout(yt.watchdog);
  yt.ch = null; $('#yt').hidden = true;
  if (yt.player && yt.ready) try { yt.player.stopVideo(); } catch {}
}
export function title() { try { return yt.player.getVideoData().title; } catch { return ''; } }
export function ytUrl() { try { return yt.player.getVideoUrl(); } catch { return ''; } }
export const ytActive = () => !!yt.ch;

// Accepts a channel URL, /channel/UC…, playlist link, video link, or raw ID.
export function parseYouTube(s) {
  s = String(s).trim();
  let m = s.match(/[?&]list=([A-Za-z0-9_-]{12,})/); if (m) return m[1];
  m = s.match(/channel\/(UC[A-Za-z0-9_-]{22})/); if (m) return m[1];
  m = s.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/); if (m) return m[1];
  m = s.match(/^(UC[A-Za-z0-9_-]{22}|UU[A-Za-z0-9_-]{22}|PL[A-Za-z0-9_-]{16,}|[A-Za-z0-9_-]{11})$/); if (m) return m[1];
  return null;
}
