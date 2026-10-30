# Adding Channels

Open **MENU › Channels › Add a channel** (or press **★ FIND**).

1. **Section:** NostalgiaVue Cable (31–200), YouTube (201–299), Podcasts (300–314), Docs · Gaming · Tech (315–350), More Cable (351–419), Bring Your Own (420–499) Pay-Per-View (500–529), Maker Lab (530–549) Game Show Network (550–579) or Late-night PPV (580–599). The next free number is filled in for you.
2. **Type**
   - **YouTube:** paste a channel link in the `youtube.com/channel/UC…` form, a playlist link, or a video link. Channels play their uploads, newest 150, a different one each half hour. `@handle` links work once you've added a YouTube API key (below). If you leave the name blank, the channel takes its real YouTube name the first time it airs.
   - **archive.org search:** any search words, or archive.org search syntax such as `collection:classic_tv AND subject:western`.
   - **Stream URL:** `.m3u8` (HLS), `.mp4`, `.mp3` and similar.
   - **M3U playlist (paste):** paste the text of an M3U file. Every entry becomes its own channel.
   - **Website shortcut:** opens a site in a new tab (good for streaming services).
3. A station logo is generated from the name and number as you type.

Untick a channel in the list to hide it from surfing and the guide. Channels you added have a ✕ to delete them.

**Back up:** MENU › System › *Export settings* saves everything, including your channels, to one file.

## Nightly pre-fetch (saves your quota)
The *Nightly YouTube pre-fetch* GitHub Action runs every night. It does up to 70 of the lineup's ~600 YouTube searches ahead of time (leaving ~30 of the free 100-a-day for live and era searches) (missing and oldest first) and saves the results with the site in `data/yt/`, so viewers' channel surfing doesn't use the API quota. It needs the key as a repository secret: **GitHub › Settings › Secrets and variables › Actions › New repository secret**, named `YT_API_KEY`. After about nine days every search channel is pre-filled; after that it keeps refreshing.

## YouTube API key
The key stays private on Vercel; it is never in the code or the page.

1. In https://console.cloud.google.com (your project with **YouTube Data API v3** enabled): *APIs & Services › Credentials*, then copy your API key. Under *API restrictions*, limit it to *YouTube Data API v3*.
2. In Vercel: **nostalgiavue › Settings › Environment Variables › Add**
   - Key: `YT_API_KEY`
   - Value: your key
   - Environments: Production (and Preview if you like)
3. **Deployments › ⋯ › Redeploy** so the new variable takes effect.

The site's `/api/yt` function then makes the YouTube lookups for every viewer, and results are cached for 6 hours to save quota. You can still put a personal key in **MENU › Sources › YouTube** to use your own quota instead.

**Check it:** **MENU › Sources › YouTube › Save & test** makes one cheap lookup and says exactly what Google answered. Keys, tokens and addresses in the menu save as you type and stay on that device. With *Sync settings* on, they also reach your other devices through the Bridge.

| The TV says | Fix |
|---|---|
| Google is blocking this key for YouTube | Google Cloud › Credentials › your key › *API restrictions*: tick **YouTube Data API v3** (or *Don't restrict key*). Save, wait a few minutes. |
| YouTube Data API v3 isn't turned on | *APIs & Services › Library › YouTube Data API v3 › Enable* in the same project as the key. |
| The key only allows certain websites or IPs | *Application restrictions*: **None** (the Vercel server has no fixed IP or referrer). |
| Today's free YouTube quota is used up | Wait for midnight Pacific, or ask for more under *Quotas*. |

This turns on:
- **ON DEMAND:** press OK on Movie Night (240–249), the Elon Channel (232), Stand-Up Legends (234), Fireside (230) and Lo-Fi Coffeehouse (231) to pick from a list of titles.
- **Seasonal fireplaces** that change with the month.
- **Adding channels by @handle.**
