# Adding Channels

Open **MENU › Channels › Add a channel** (or press **★ FIND**).

1. **Section:** NostalgiaVue Cable (31–200), YouTube (201–299), Podcasts (300–350), More Cable (351–419), Bring Your Own (420–499) or Pay-Per-View (500–599). The next free number is filled in for you.
2. **Type**
   - **YouTube:** paste a channel link in the `youtube.com/channel/UC…` form, a playlist link, or a video link. Channels play their uploads, newest 150, a different one each half hour. `@handle` links work once you've added a YouTube API key (below). If you leave the name blank, the channel takes its real YouTube name the first time it airs.
   - **archive.org search:** any search words, or archive.org search syntax such as `collection:classic_tv AND subject:western`.
   - **Stream URL:** `.m3u8` (HLS), `.mp4`, `.mp3` and similar.
   - **M3U playlist (paste):** paste the text of an M3U file. Every entry becomes its own channel.
   - **Website shortcut:** opens a site in a new tab (good for streaming services).
3. A station logo is generated from the name and number as you type.

Untick a channel in the list to hide it from surfing and the guide. Channels you added have a ✕ to delete them.

**Back up:** MENU › System › *Export settings* saves everything, including your channels, to one file.

## YouTube API key (optional, free)
1. Go to https://console.cloud.google.com, create a project, and enable **YouTube Data API v3**.
2. *Credentials › Create credentials › API key*. Restrict it to *YouTube Data API v3* and to the website `nostalgiavue.vercel.app/*`.
3. Paste it into **MENU › Sources › YouTube › API key**.

This turns on:
- **ON DEMAND:** press OK on Movie Night (240–249), the Elon Channel (232), Stand-Up Legends (234), Fireside (230) and Lo-Fi Coffeehouse (231) to pick from a list of titles.
- **Seasonal fireplaces** that change with the month.
- **Adding channels by @handle.**

The free quota covers about 100 searches a day. NostalgiaVue caches results for the day, so normal channel surfing uses only a handful.
