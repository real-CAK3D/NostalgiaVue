# Stats & Ratings

## On every TV
- **INFO** shows how many TVs are watching the channel right now (👁), its average rating, how long you've watched it, and your own stars. With INFO up, press **1–5** to rate the channel, **0** to clear your rating, or click the stars.
- The channel banner shows 👁 and the number watching, when it's known.
- **MENU › Stats › This TV:** your total watch time, your most-watched channels, time by category, the last 7 days and your ratings. It's all stored on this device; **Reset my stats & ratings** erases it.

## Everyone (shared counts)
**MENU › Stats › Everyone:** TVs on right now and today, what everyone is watching right now, most watched today and of all time, top-rated channels and time by category.

Shared counts are anonymous. Each TV makes up a random id and, once a minute, sends only that id, the channel number and its category. Turn it off with **Share anonymous viewing counts**.

### Turning on the shared counts (site owner, once)
They need a small free database:
1. Vercel › **nostalgiavue** › **Storage** › **Create Database** › **Upstash for Redis** (free plan) › connect it to the project.
2. Redeploy. The `KV_REST_API_URL` / `KV_REST_API_TOKEN` variables it adds are picked up by `api/stats.js`.

Until then each TV shows only its own stats.
