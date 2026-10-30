// Vercel serverless proxy for the YouTube Data API. The key lives in the YT_API_KEY
// environment variable (Vercel › Project › Settings › Environment Variables), never in the page.
// Only the two read-only lookups NostalgiaVue needs are allowed, and responses are cached at the
// edge for a day so everyone watching shares the daily quota.
const OPS = {
  ping: null,
  search: { path: 'search', fixed: { part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '50' }, allow: ['q', 'channelId', 'videoDuration'] },
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
    if (typeof v === 'string' && v.length && v.length < 200) params.set(k, v);
  }
  params.set('key', key);
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/${spec.path}?${params}`);
    const body = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: body.error?.message || 'YouTube error' });
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');
    return res.status(200).json(body);
  } catch {
    return res.status(502).json({ error: 'YouTube unreachable' });
  }
}
