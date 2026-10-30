// Local media: folders on your own drives (via the NostalgiaVue Bridge over Tailscale)
// and Jellyfin libraries. Both become scheduled channels like any other.
import { shuffle, hash, daySeed, fetchJSON } from '../util.js';
import { settings, state } from '../store.js';
import { airList, resumeAt } from '../player.js';
import { staticOn, msg, scene } from '../osd.js';
import { esc } from '../util.js';

/* ---------- NostalgiaVue Bridge ---------- */
const bridgeBase = () => settings.bridgeUrl.replace(/\/+$/, '');
const tok = () => settings.bridgeToken ? `t=${encodeURIComponent(settings.bridgeToken)}` : '';
export function bridgeUrl(path, q = '') {
  const qs = [q, tok()].filter(Boolean).join('&');
  return `${bridgeBase()}${path}${qs ? '?' + qs : ''}`;
}
export const bridgeFile = rel => bridgeUrl('/f/' + rel.split('/').map(encodeURIComponent).join('/'));
export const bridgeApi = (path, params = {}) => fetchJSON(bridgeUrl(path, new URLSearchParams(params).toString()), {}, 20000);
export const bridgeReady = () => !!settings.bridgeUrl;

const cache = new Map();
async function bridgeList(path) {
  const key = 'b|' + path + '|' + daySeed();
  if (!cache.has(key)) {
    const pr = bridgeApi('/api/list', { path }).then(j => (j.files || []).map(f => ({ ...f, src: 'bridge' })));
    pr.catch(() => cache.delete(key)); cache.set(key, pr);
  }
  return cache.get(key);
}
async function resolveBridge(f) {
  return {
    kind: f.kind === 'audio' ? 'audio' : 'video',
    groups: [[{ url: bridgeFile(f.path), len: f.dur || 0, title: f.name, sub: f.subs ? { url: bridgeFile(f.subs) } : null }]],
    title: f.name.replace(/\.[^.]+$/, '').replace(/[._]+/g, ' '),
    sub: f.path.split('/').slice(0, -1).join(' › '),
    art: null, desc: '', link: '',
  };
}

/* ---------- Jellyfin ---------- */
const jfBase = () => settings.jellyfinUrl.replace(/\/+$/, '');
const jfKey = () => encodeURIComponent(settings.jellyfinKey);
export const jellyfinReady = () => !!(settings.jellyfinUrl && settings.jellyfinKey);
export async function jellyfinLibraries() {
  const j = await fetchJSON(`${jfBase()}/Library/MediaFolders?api_key=${jfKey()}`);
  return (j.Items || []).map(i => ({ id: i.Id, name: i.Name, type: i.CollectionType || '' }));
}
async function jellyfinList(parentId) {
  const key = 'j|' + parentId + '|' + daySeed();
  if (!cache.has(key)) {
    const p = new URLSearchParams({ ParentId: parentId, Recursive: 'true', IncludeItemTypes: 'Movie,Episode,MusicVideo,Video,Audio', Fields: 'Overview,ProductionYear', Limit: '2000', api_key: settings.jellyfinKey });
    const pr = fetchJSON(`${jfBase()}/Items?${p}`).then(j => j.Items || []);
    pr.catch(() => cache.delete(key)); cache.set(key, pr);
  }
  return cache.get(key);
}
async function resolveJellyfin(it) {
  const b = jfBase(), k = jfKey(), id = it.Id, len = it.RunTimeTicks ? it.RunTimeTicks / 1e7 : 0;
  const audio = it.MediaType === 'Audio' || it.Type === 'Audio';
  const groups = audio
    ? [[{ url: `${b}/Audio/${id}/stream.mp3?api_key=${k}`, len }]]
    : [[{ url: `${b}/Videos/${id}/master.m3u8?api_key=${k}&MediaSourceId=${id}&VideoCodec=h264&AudioCodec=aac,mp3&TranscodingMaxAudioChannels=2&SegmentContainer=ts`, len, hls: true }],
       [{ url: `${b}/Videos/${id}/stream?static=true&api_key=${k}`, len }]];
  // text subtitles Jellyfin knows about (English first), served as WebVTT
  let subs = [];
  if (!audio) {
    try {
      const j = await fetchJSON(`${b}/Items?Ids=${id}&Fields=MediaStreams&api_key=${k}`);
      const st = ((j.Items || [])[0]?.MediaStreams || []).filter(m => m.Type === 'Subtitle' && m.IsTextSubtitleStream !== false);
      st.sort((x, y) => (y.Language === 'eng') - (x.Language === 'eng'));
      subs = st.slice(0, 1).map(m => ({ url: `${b}/Videos/${id}/${id}/Subtitles/${m.Index}/0/Stream.vtt?api_key=${k}`, lang: (m.Language || 'en').slice(0, 2) }));
    } catch {}
  }
  return {
    kind: audio ? 'audio' : 'video', groups, subs,
    title: it.SeriesName ? `${it.SeriesName} — ${it.Name}` : it.Name,
    sub: [it.ProductionYear, it.Type].filter(Boolean).join(' · '),
    art: `${b}/Items/${id}/Images/Primary?maxHeight=400&api_key=${k}`,
    desc: it.Overview || '', link: '',
  };
}

/* ---------- tuning ---------- */
/* ---------- library: OK on a local channel lists everything in it, with resume points ---------- */
const lib = { open: false, items: [], sel: 0, ch: null, resolve: null };
export const libraryOpen = () => lib.open;
const fmtT = s => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ':' : ''}${String(Math.floor(s / 60) % 60).padStart(Math.floor(s / 3600) ? 2 : 1, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export async function openLibrary(ch) {
  const m = ch.map; if (!m) return false;
  try {
    lib.items = m.type === 'jellyfin' ? await jellyfinList(m.parentId) : await bridgeList(m.path);
    lib.resolve = m.type === 'jellyfin' ? resolveJellyfin : resolveBridge;
  } catch { return false; }
  lib.items = [...lib.items].sort((a, b) => libName(a).localeCompare(libName(b), undefined, { numeric: true }));
  lib.open = true; lib.ch = ch; lib.sel = 0; renderLibrary(); return true;
}
const libName = it => it.path ? it.path.split('/').slice(1).join(' › ').replace(/\.[^.]+$/, '') : (it.SeriesName ? `${it.SeriesName} › ${it.Name}` : it.Name);
const libKey = it => it.path ? bridgeFile(it.path).replace(/[?&]t=[^&]*/g, '') : `${jfBase()}/Videos/${it.Id}`;
function renderLibrary() {
  scene(`<div class="ondemand"><div class="od-head">LIBRARY · ${esc(lib.ch.name)}<small>▲▼ choose · OK play (resumes where you stopped) · BACK close</small></div>
    <div class="od-list">${lib.items.map((it, i) => { const r = resumeAt(libKey(it)); return `<div class="od-item${i === lib.sel ? ' sel' : ''}" data-i="${i}"><b>${esc(libName(it))}</b><small>${r ? '▶ resume at ' + fmtT(r) : ''}</small></div>`; }).join('')}</div></div>`, 'odscene');
  const list = document.querySelector('.od-list');
  list.onclick = e => { const it = e.target.closest('.od-item'); if (it) { lib.sel = +it.dataset.i; libraryOK(); } };
  list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
}
export function libraryNav(d) { if (!lib.open) return false; lib.sel = (lib.sel + d + lib.items.length) % lib.items.length; renderLibrary(); return true; }
export function libraryOK() {
  if (!lib.open) return false;
  const it = lib.items[lib.sel]; lib.open = false; staticOn();
  airList(lib.ch, [it], lib.resolve, state.token, { fromStart: true, resume: true });
  return true;
}
export function closeLibrary() { if (!lib.open) return false; lib.open = false; scene(''); return true; }

export async function tuneLocal(ch, token) {
  lib.open = false;
  const m = ch.map;
  if (!m) { staticOn(); msg(`LOCAL ${ch.n}`, 'Not set up yet — MENU › Sources to pick a folder or Jellyfin library'); return; }
  let list, resolve;
  try {
    if (m.type === 'jellyfin') {
      if (!jellyfinReady()) throw new Error('jellyfin');
      list = await jellyfinList(m.parentId); resolve = resolveJellyfin;
    } else {
      if (!bridgeReady()) throw new Error('bridge');
      list = await bridgeList(m.path); resolve = resolveBridge;
    }
  } catch {
    if (token !== state.token) return;
    staticOn(); msg('LOCAL SIGNAL LOST', m.type === 'jellyfin' ? 'Can’t reach Jellyfin — are you on Tailscale?' : 'Can’t reach the NostalgiaVue Bridge — are you on Tailscale?');
    return;
  }
  if (token !== state.token) return;
  if (!list.length) { staticOn(); msg('NO SIGNAL', 'That folder has no playable video or audio'); return; }
  return airList(ch, shuffle(list, hash(daySeed(), ch.n)), resolve, token);
}

/* ---------- direct streams (BYO) ---------- */
export async function tuneStream(ch, token) {
  const isAudio = /\.(mp3|aac|ogg|m4a|flac|wav)(\?|$)/i.test(ch.url) || ch.audio;
  const p = { kind: isAudio ? 'audio' : 'video', groups: [[{ url: ch.url, len: 0, hls: /\.m3u8/i.test(ch.url) }]], title: ch.name, sub: 'Live stream', art: null, desc: ch.desc || '', link: ch.url };
  return airList(ch, [ch], async () => p, token);
}
// M3U playlist -> channel definitions
export function parseM3U(text) {
  const out = []; let pending = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const name = line.split(',').slice(1).join(',').trim();
      const logo = (line.match(/tvg-logo="([^"]*)"/) || [])[1];
      pending = { name: name || 'Stream', logo };
    } else if (!line.startsWith('#')) {
      out.push({ name: pending?.name || line.split('/').pop(), url: line });
      pending = null;
    }
  }
  return out;
}
