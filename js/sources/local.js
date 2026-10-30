// Local media: folders on your own drives (via the NostalgiaVue Bridge over Tailscale)
// and Jellyfin libraries. Both become scheduled channels like any other.
import { shuffle, hash, daySeed, fetchJSON } from '../util.js';
import { settings, state } from '../store.js';
import { airList } from '../player.js';
import { staticOn, msg } from '../osd.js';

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
    groups: [[{ url: bridgeFile(f.path), len: f.dur || 0, title: f.name }]],
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
  return {
    kind: audio ? 'audio' : 'video', groups,
    title: it.SeriesName ? `${it.SeriesName} — ${it.Name}` : it.Name,
    sub: [it.ProductionYear, it.Type].filter(Boolean).join(' · '),
    art: `${b}/Items/${id}/Images/Primary?maxHeight=400&api_key=${k}`,
    desc: it.Overview || '', link: '',
  };
}

/* ---------- tuning ---------- */
export async function tuneLocal(ch, token) {
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
