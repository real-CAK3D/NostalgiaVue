# NostalgiaVue

**The picture of yesterday.** NostalgiaVue is a web app that puts a 1980s, 1990s or 2000s TV set in your browser. It has a remote, a channel guide, static between channels and commercial breaks. It channel-surfs archive.org, YouTube, the local weather and your own drives.

▶ **Watch:** https://nostalgiavue.vercel.app  ·  📖 **Docs:** [the wiki](https://github.com/real-CAK3D/NostalgiaVue/wiki) (sources in [`docs/`](docs))

## What's on

| Dial | What |
|---|---|
| 1 2 4 5 7 11 14–20 | **Local media.** Folders on your own drives (e.g. `E:\Videos`) or Jellyfin libraries, over Tailscale |
| 3 | **Game Channel.** ROMs from `E:\ROMs`, played in the browser with EmulatorJS (keyboard, USB/Bluetooth controller, or touch) |
| 6 8 9 10 12 13 21–30 | **Local TV** for your ZIP. 04240 is preset: WCSH 6, WMTW 8, WCBB 10, WGME 13, WPFO 23 … plus *Local on the 9s* weather |
| 31–200 | **NostalgiaVue Cable.** 170 themed channels from archive.org: cartoons, Three Stooges, Monty Python, cops & chases, Bill Nye, westerns, horror, MST3K, music videos, shopping, auctions, religious satire… |
| 201–299 | **YouTube.** Adult Swim, Cartoon Network, WB Kids, Mr Bean, PBS Kids, SNL, MADtv, plus whatever you add |
| 300–350 | **Podcasts.** Joe Rogan, StarTalk, archive.org podcast radio |
| 351–419 | **More Cable.** Another ~70 themed channels |
| 420–499 | **Bring your own.** Stream links, M3U playlists, anything |
| 500–599 | **Pay-Per-View.** Shortcuts to Netflix, Max, Pluto TV, Tubi… |

More than 300 channels out of the box. Every channel, including ones you add, gets a generated station logo. The full list is in [docs/Channel-Lineup.md](docs/Channel-Lineup.md).

## Features
- Three TV sets: the **Space Commander 25"** wood console (1980s), the **TrinoTube KV-27** (1990s) and the **FlatFace Pro 32"** (2000s). Each set has its own remote, on-screen display, menu style and sounds.
- Show or hide the remote, or switch to **screen-only zoom** and full screen.
- Half-hour broadcast schedule: tuning in drops you into whatever's already on.
- A Prevue-style **GUIDE** with colored categories, plus a **Guide Channel** (31) that scrolls the grid on its own.
- **Commercial breaks** every 10/15/20/30 minutes, using real vintage ads (can be turned off).
- **NostalgiaVue logo animation** at power-on. All sounds are synthesized: relay clicks, degauss thump, static, 15.7 kHz whine and the dial clunk.
- Settings for picture (scanlines, phosphor mask, glass, color), sound, commercials, location, sources and channels. Back up and restore all settings as one file.
- Installs as an app on phones and desktops (PWA), so it can run full screen.

## Run it locally
It's static files, so you don't need a build step:
```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

## Local media & games (Tailscale)
Your drives are shared with the TV through the **NostalgiaVue Bridge** (`bridge/`). It's a small Python server that runs on your PC and is only reachable over your Tailscale network. See [Local Media & the Bridge](docs/Local-Media-and-the-Bridge.md).

## Deploying
The repo deploys to Vercel as a static site, so you don't need to set a framework or build command. `vercel.json` sets the headers.

## Credits
Programs stream from [archive.org](https://archive.org) and YouTube; NostalgiaVue doesn't host any video. Weather is from [Open-Meteo](https://open-meteo.com). Games run on [EmulatorJS](https://emulatorjs.org).
