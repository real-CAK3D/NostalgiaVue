// Vercel serverless proxy for the YouTube Data API. The key lives in the YT_API_KEY
// environment variable (Vercel › Project › Settings › Environment Variables), never in the page.
// Only the read-only lookups NostalgiaVue needs are allowed, and responses are cached at the
// edge for a day so everyone watching shares the daily quota.
const OPS = {
  ping: null,
  search: { path: 'search', fixed: { part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '50' }, allow: ['q', 'channelId', 'videoDuration', 'eventType', 'safeSearch'] },
  // which results can actually play inside the TV (age-restricted and no-embed videos can't)
  videos: { path: 'videos', fixed: { part: 'contentDetails,status', maxResults: '50' }, allow: ['id'] },
  playlists: { path: 'playlists', fixed: { part: 'snippet', maxResults: '50' }, allow: ['id'] },
  channels: { path: 'channels', fixed: { part: 'id,snippet' }, allow: ['forHandle', 'id'] },
};

export default async function handler(req, res) {
  const key = process.env.YT_API_KEY;
  const op = OPS[req.query.op] !== undefined ? req.query.op : null;
  if (!op) return res.status(400).json({ error: 'unknown op' });
  if (!key) return res.status(503).json({ error: 'YT_API_KEY is not set' });
  if (op === 'ping') { res.setHeader('Cache-Control', 'public, s-maxage=300'); return res.status(200).json({ ok: true }); }
  const spec = OPS[op], params = new URLSearchParams(spec.fixed);
  for (const k of spec.allow) {
    const v = req.query[k];
    if (typeof v === 'string' && v.length && v.length < (k === 'id' ? 2000 : 200)) params.set(k, v);
  }
  params.set('key', key);
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/${spec.path}?${params}`);
    const body = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: body.error?.message || 'YouTube error' });
    // live searches go stale fast; everything else is good for a day
    res.setHeader('Cache-Control', req.query.eventType === 'live' ? 'public, s-maxage=1800' : 'public, s-maxage=86400, stale-while-revalidate=172800');
    return res.status(200).json(body);
  } catch {
    return res.status(502).json({ error: 'YouTube unreachable' });
  }
}
