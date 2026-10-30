// Nightly YouTube pre-fetch (run by .github/workflows/prefetch.yml).
// Does the YouTube searches for every search-driven channel ahead of time and saves the results
// with the site in data/yt/, so viewers' channel surfing doesn't spend the API quota.
// Each night it refreshes the missing and oldest searches, up to YT_BUDGET searches (100 quota units each).
import fs from 'node:fs';
import path from 'node:path';
import { buildLineup } from '../js/lineup.js';
import { ytCacheKey, ytCacheFile } from '../js/ytcache.js';

const KEY = process.env.YT_API_KEY;
const BUDGET = +(process.env.YT_BUDGET || 70); // leaves ~30 of the 100 daily searches for viewers
const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data', 'yt');
if (!KEY) { console.error('YT_API_KEY is not set'); process.exit(1); }
fs.mkdirSync(DIR, { recursive: true });
const indexPath = path.join(DIR, '_index.json');
const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : {};

// every search the lineup can make (live searches are skipped: they go stale within hours)
const wanted = new Map();
for (const ch of buildLineup()) {
  const s = ch.kind === 'yt' && ch.search; if (!s || s.live) continue;
  const qs = typeof s.q === 'function' ? s.q() : [].concat(s.q);
  for (const q of qs) for (const c of (s.channels && s.channels.length ? s.channels : [null])) {
    const key = ytCacheKey(q, { channelId: c, long: s.long });
    wanted.set(key, { q, channelId: c, long: !!s.long });
  }
}
const order = [...wanted.keys()].sort((a, b) => (index[a]?.t || 0) - (index[b]?.t || 0));
console.log(`${wanted.size} searches in the lineup, ${order.filter(k => !index[k]).length} never fetched; budget ${BUDGET}`);

let done = 0;
for (const key of order.slice(0, BUDGET)) {
  const { q, channelId, long } = wanted.get(key);
  const p = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '30', q, videoEmbeddable: 'true', key: KEY });
  if (channelId) p.set('channelId', channelId);
  if (long) p.set('videoDuration', 'long');
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${p}`);
  const j = await r.json();
  if (!r.ok) {
    console.log(`stopping: ${r.status} ${j.error?.message || ''}`);
    break;
  }
  const items = (j.items || []).filter(i => i.id?.videoId).map(i => [i.id.videoId, i.snippet.title, i.snippet.channelTitle]);
  const file = ytCacheFile(key);
  fs.writeFileSync(path.join(DIR, file), JSON.stringify(items));
  index[key] = { t: Date.now(), f: file, n: items.length };
  done++;
}
// forget searches that are no longer in the lineup
for (const k of Object.keys(index)) if (!wanted.has(k)) { try { fs.unlinkSync(path.join(DIR, index[k].f)); } catch {} delete index[k]; }
fs.writeFileSync(indexPath, JSON.stringify(index, null, 0));
console.log(`fetched ${done}; cache now holds ${Object.keys(index).length} of ${wanted.size} searches`);
