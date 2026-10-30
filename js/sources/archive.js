// archive.org: saved searches become channels; items become programs.
import { one, shuffle, hash, daySeed, parseLen, stripHtml, fetchJSON } from '../util.js';
import { settings, state, eraOn, eraRange } from '../store.js';
import { airList } from '../player.js';
import { bars, staticOn, msg } from '../osd.js';

export const API = 'https://archive.org';

// Only a few searches at a time; the channel being tuned jumps the queue.
let active = 0; const waiting = [];
async function limited(fn, urgent) {
  if (active >= 4) await new Promise(r => urgent ? waiting.unshift(r) : waiting.push(r));
  active++;
  try { return await fn(); } finally { active--; const n = waiting.shift(); if (n) n(); }
}
export function search(q, rows = 200, urgent = false, sort = 'downloads desc') {
  return limited(async () => {
    const p = new URLSearchParams({ q, rows: String(rows), page: '1', output: 'json' });
    ['identifier', 'title', 'year', 'creator', 'mediatype'].forEach(f => p.append('fl[]', f));
    p.append('sort[]', sort);
    const j = await fetchJSON(`${API}/advancedsearch.php?${p}`);
    return (j.response || {}).docs || [];
  }, urgent);
}

const lists = new Map(); export const listsDone = new Map();
export const listKey = ch => `${ch.n}|${daySeed()}|${ch.custom ? settings.custom : ''}|${(ch.q || []).join('§')}|${eraOn() ? eraRange().join('-') : ''}`;
export function getList(ch, urgent) {
  const key = listKey(ch);
  if (!lists.has(key)) {
    const pr = (async () => {
      const qs = ch.custom ? (settings.custom ? [settings.custom] : []) : (ch.q || []);
      const type = ch.custom || ch.anyType ? '(movies OR audio)' : ch.audio ? 'audio' : 'movies';
      // with an era picked, try that range first; a channel with nothing from then keeps its normal lineup
      const eras = eraOn() ? [` AND year:[${eraRange().join(' TO ')}]`, ''] : [''];
      for (const era of eras) {
        for (const q of qs) {
          const base = `(${q}) AND mediatype:${type}${era}`;
          let docs = await search(base + ' AND -access-restricted-item:true', ch.rows || 200, urgent);
          if (!docs.length) docs = await search(base, ch.rows || 200, urgent);
          const seen = new Set(); docs = docs.filter(d => d.identifier && !seen.has(d.identifier) && seen.add(d.identifier));
          if (docs.length) return shuffle(docs, hash(daySeed(), ch.n));
        }
      }
      return [];
    })();
    lists.set(key, pr);
    pr.then(l => listsDone.set(key, l), () => { lists.delete(key); listsDone.set(key, null); });
  }
  return lists.get(key);
}

const metas = new Map();
export function getMeta(id) {
  if (!metas.has(id)) {
    const pr = fetchJSON(`${API}/metadata/${encodeURIComponent(id)}`);
    pr.catch(() => metas.delete(id));
    metas.set(id, pr);
  }
  return metas.get(id);
}

// Browser-friendly encodings first: h.264 derivatives play everywhere; raw MPEG4 uploads often don't.
const VFMT = ['h.264', 'h.264 IA', '512Kb MPEG4', 'MPEG4', 'WebM', 'Ogg Video', 'h.264 HD'];
const AFMT = ['VBR MP3', '128Kbps MP3', 'MP3', '64Kbps MP3', 'Ogg Vorbis'];
function groupsFor(files, fmts, exts) {
  const g = new Map();
  for (const f of files) {
    let k = fmts.find(x => x.toLowerCase() === String(f.format || '').toLowerCase());
    if (!k) { const e = f.name.split('.').pop().toLowerCase(); if (!exts.includes(e)) continue; k = '.' + e; }
    if (!g.has(k)) g.set(k, []); g.get(k).push(f);
  }
  const pri = k => { const i = fmts.indexOf(k); return i < 0 ? 99 : i; };
  return [...g.entries()].sort((a, b) => pri(a[0]) - pri(b[0])).map(e => e[1]);
}
const fileUrl = (id, name) => `${API}/download/${encodeURIComponent(id)}/${name.split('/').map(encodeURIComponent).join('/')}`;

export async function resolveItem(doc) {
  const id = doc.identifier, meta = await getMeta(id);
  if (!meta || !Array.isArray(meta.files) || meta.is_dark) return null;
  const md = meta.metadata || {};
  if (String(md['access-restricted-item']) === 'true') return null;
  const files = meta.files.filter(f => f.name && !/\.thumbs\/|__ia_thumb|sample/i.test(f.name));
  let kind = 'video', groups = groupsFor(files, VFMT, ['mp4', 'm4v', 'webm', 'ogv']);
  if (!groups.length) { kind = 'audio'; groups = groupsFor(files, AFMT, ['mp3', 'ogg']); }
  if (!groups.length) return null;
  const order = (a, b) => ((parseInt(a.track) || 0) - (parseInt(b.track) || 0)) || a.name.localeCompare(b.name, undefined, { numeric: true });
  groups = groups.map(arr => arr.sort(order).map(f => ({ url: fileUrl(id, f.name), len: parseLen(f.length), title: f.title || f.name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ') })));
  return {
    kind, groups,
    title: one(md.title) || one(doc.title) || id,
    sub: [one(md.year) || one(doc.year), one(md.creator) || one(doc.creator)].filter(Boolean).join(' · '),
    art: `${API}/services/img/${encodeURIComponent(id)}`,
    desc: stripHtml(one(md.description)),
    link: `${API}/details/${encodeURIComponent(id)}`,
  };
}

export async function tuneArchive(ch, token, opts = {}) {
  if (ch.custom && !settings.custom) { staticOn(); msg(`CHANNEL ${ch.n}`, 'Press ★ on the remote to program your own channel'); return; }
  let list;
  try { list = await getList(ch, true); }
  catch { if (token === state.token) bars('TECHNICAL DIFFICULTIES', 'Can’t reach archive.org — please stand by'); return; }
  if (token !== state.token) return;
  if (!list.length) { staticOn(); msg('NO SIGNAL', 'Nothing is airing on this channel'); return; }
  return airList(ch, list, resolveItem, token, opts);
}
