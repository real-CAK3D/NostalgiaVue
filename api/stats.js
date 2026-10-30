// Shared, anonymous channel stats for everyone watching NostalgiaVue: who's watching what right
// now, minutes watched per channel and category, and star ratings. No accounts: each TV sends a
// random id it made up itself. Stored in a free Upstash Redis database connected to the Vercel
// project (Vercel › Storage › Upstash for Redis), which sets the two REST variables used here.
// Without it, this returns 503 and the TV shows its own on-device stats only.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LIVE_SECS = 150;          // a TV counts as watching if it checked in this recently

async function redis(cmds) {
  const r = await fetch(`${URL_}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).map(x => x.result);
}
const day = () => new Date().toISOString().slice(0, 10);
const okId = id => typeof id === 'string' && /^[a-z0-9]{8,40}$/.test(id);
const okCh = n => Number.isInteger(n) && n > 0 && n < 10000;
const okCat = c => typeof c === 'string' && /^[A-Z0-9 &'·+-]{1,24}$/.test(c);
const pairs = a => { const o = {}; for (let i = 0; a && i < a.length; i += 2) o[a[i]] = +a[i + 1]; return o; };

// who is watching what: ids seen recently -> their channel
async function liveCounts() {
  const now = Math.floor(Date.now() / 1000);
  const [, ids] = await redis([['ZREMRANGEBYSCORE', 'live', 0, now - LIVE_SECS], ['ZRANGE', 'live', 0, 999]]);
  if (!ids || !ids.length) return { total: 0, by: {} };
  const [chs] = await redis([['MGET', ...ids.map(i => 'now:' + i)]]);
  const by = {};
  for (const c of chs || []) if (c) by[c] = (by[c] || 0) + 1;
  return { total: ids.length, by };
}

export default async function handler(req, res) {
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'stats database not connected' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!okId(b.id)) return res.status(400).json({ error: 'bad id' });
      const now = Math.floor(Date.now() / 1000);
      if (b.op === 'beat') {
        if (!okCh(b.ch) || !okCat(b.cat)) return res.status(400).json({ error: 'bad channel' });
        // a minute of watching is counted at most once a minute per TV
        const [first] = await redis([['SET', 'beat:' + b.id, '1', 'NX', 'EX', 55]]);
        const cmds = [['ZADD', 'live', now, b.id], ['SET', 'now:' + b.id, String(b.ch), 'EX', LIVE_SECS]];
        if (first === 'OK') cmds.push(
          ['ZINCRBY', 'mins:' + day(), 1, String(b.ch)], ['EXPIRE', 'mins:' + day(), 60 * 60 * 24 * 40],
          ['ZINCRBY', 'mins:all', 1, String(b.ch)], ['HINCRBY', 'catmins', b.cat, 1], ['SADD', 'tvs:' + day(), b.id], ['EXPIRE', 'tvs:' + day(), 60 * 60 * 24 * 40]);
        await redis(cmds);
        const live = await liveCounts();
        return res.status(200).json({ watching: live.by[b.ch] || 0, total: live.total });
      }
      if (b.op === 'leave') { await redis([['ZREM', 'live', b.id], ['DEL', 'now:' + b.id]]); return res.status(200).json({ ok: true }); }
      if (b.op === 'rate') {
        const stars = +b.stars;
        if (!okCh(b.ch) || !(stars >= 0 && stars <= 5 && Number.isInteger(stars))) return res.status(400).json({ error: 'bad rating' });
        const [old] = await redis([['HGET', 'rate:' + b.ch, b.id]]);
        const o = +old || 0;
        const cmds = stars ? [['HSET', 'rate:' + b.ch, b.id, stars]] : [['HDEL', 'rate:' + b.ch, b.id]];
        cmds.push(['HINCRBY', 'ratesum', String(b.ch), stars - o]);
        if (!o && stars) cmds.push(['HINCRBY', 'ratecnt', String(b.ch), 1]);
        if (o && !stars) cmds.push(['HINCRBY', 'ratecnt', String(b.ch), -1]);
        await redis(cmds);
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'unknown op' });
    }
    // GET: the whole picture, for the Stats tab and the INFO panel
    const [today, all, cats, sum, cnt, tvs] = await redis([
      ['ZREVRANGE', 'mins:' + day(), 0, 49, 'WITHSCORES'], ['ZREVRANGE', 'mins:all', 0, 49, 'WITHSCORES'],
      ['HGETALL', 'catmins'], ['HGETALL', 'ratesum'], ['HGETALL', 'ratecnt'], ['SCARD', 'tvs:' + day()],
    ]);
    const live = await liveCounts();
    const s = pairs(sum), c = pairs(cnt), ratings = {};
    for (const k of Object.keys(c)) if (c[k] > 0) ratings[k] = { avg: Math.round(s[k] / c[k] * 10) / 10, n: c[k] };
    return res.status(200).json({ live, today: pairs(today), all: pairs(all), cats: pairs(cats), ratings, tvsToday: tvs || 0 });
  } catch {
    return res.status(502).json({ error: 'stats database unreachable' });
  }
}
