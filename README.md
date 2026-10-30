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
| 201–249 | **YouTube.** Adult Swim, Cartoon Network, Boomerang, WB Kids, SNL, TED/TEDx/TED-Ed, Fireside & Lo-Fi Coffeehouse, the Elon Channel, Stand-Up Legends, Movie Night by genre (240–249)… |
| 250–299 | **Classic TV block.** TMNT, Bob Lazar & the Aliens, Hitchcock, Conspiracy, VH1, History, Animal Planet, Zoboomafoo, Sesame Street, Kratts’ Creatures, Steve Irwin, Black Sheep Squadron, Car 54, F Troop, The A-Team, Baywatch, doctor shows, late night & daytime talk, Martha Stewart, Rachael Ray, Martha & Snoop, High Times TV, Seinfeld, Big Bang Theory, Everybody Hates Chris, Malcolm in the Middle, King of the Hill, hunting, Jack Hanna, Warren Miller, X Games, Red Bull & Flugtag, BMX, AFV, Rob Dyrdek, Jackass, Wildboyz, Power Rangers, the Crypt Keeper, Goosebumps, Ripley’s, Scary Stories… |
| 300–350 | **Podcasts.** Joe Rogan, StarTalk, Tony Hawk, Friends Keep Secrets, Theo Von, Bertcast, archive.org podcast radio |
| 351–419 | **More Cable.** Another ~70 themed channels, ending with **419 Half Baked** |
| 420–499 | **Bring your own.** Stream links, M3U playlists, anything |
| 500–599 | **Pay-Per-View.** PPV events that play on the TV, plus shortcuts to Netflix, Max, Pluto TV, Tubi… |
| 600–699 | **My Playlists.** Your YouTube playlists, named after their real titles |
| 800–899 | **Shows A–Z.** Kids’ WB!, The WB, Animaniacs, Pinky and the Brain, Tiny Toons, Freakazoid, Batman TAS, Pokémon, Scooby-Doo, Dexter, Powerpuff, Rugrats, DuckTales, X-Men, ThunderCats, Fresh Prince, Saved by the Bell, Friends, X-Files, Buffy, Toonami, SNICK, TGIF, Fox Kids, Mork & Mindy, NewsRadio, Joe Rogan’s Early TV, Robin Williams, 3rd Rock, Perfect Strangers, Wonder Years, Cheers, Taxi, Golden Girls, Tim Conway’s Dorf, Wild America’s Wacky Babies, Milton Friedman, Einstein, a Lecture Hall, Science Classics, Retro Music Videos, Band Footage, Rap City… |
| 900–999 | **More Shows.** Dilbert, Billy & Mandy, Celebrity Deathmatch, Robot Chicken, Whose Line, Drew Carey, Matlock, Monk, Murder She Wrote, Three’s Company, Gilligan’s Island, M\*A\*S\*H, The Man Show, Mind of Mencia, Chappelle’s Show, Austin Powers, Crank Yankers, Tom Green, Ali G, Reno 911!, Mr. Show, Key & Peele, In Living Color, Adult Swim classics, South Park, Family Guy, Always Sunny, The Daily Show, MTV reality (Real World, Punk’d, Viva La Bam, Pimp My Ride, Cribs), Benny Hill, an **After Dark** block (912–915 and 966–971, PIN-locked: Kaloopy, Red Shoe Diaries, Spring Break, teen sex comedies, Playboy After Dark, grindhouse and burlesque), plus the **sports block** at 950: golf, pro and college football, soccer, rugby, MMA, hockey, lingerie football |
| 700–799 | **LIVE.** Every YouTube channel’s live stream (OK jumps to its regular channel), plus 24/7 live news, NASA, ISS, animal cams, lo-fi radio… |

More than 630 channels out of the box. Every channel, including ones you add, gets a generated station logo. The full list is in [docs/Channel-Lineup.md](docs/Channel-Lineup.md).

## Features
- Nine TV sets, three per decade. **1980s:** Space Commander 25" wood console, Portavision 13" portable, Monitor/Receiver 27". **1990s:** TrinoTube KV-27, VCR Combo 13", BigVue 32" Surround. **2000s:** FlatFace Pro 32", WideTube 30" HD, PlasmaVue 42" (widescreen sets pillarbox the 4:3 picture). Each decade has its own remote, on-screen display, menu style and sounds: 80s dials click once per detent, 90s tuners tick, 2000s sets beep.
- Real warm-up: switch snap, relay, degauss thump and hum, flyback whine, snow, then the picture.
- **ON DEMAND:** once `YT_API_KEY` is set on Vercel, YouTube channels like Movie Night, the Elon Channel and Stand-Up Legends get a list of titles to pick from (press OK).
- **Era selector** (MENU › Channels): pick a decade or any year range and the whole TV airs content from those years.
- Show or hide the remote, or switch to **screen-only zoom** and full screen.
- Half-hour broadcast schedule: tuning in drops you into whatever's already on.
- A color-coded **GUIDE** (every category has its own color) in four styles: Prevue, 2000s TV Guide Channel, cable-box green screen and 80s teletext. Press INFO in the guide to flip styles. Plus a **Guide Channel** (31) that scrolls the grid on its own.
- **Commercial breaks** every 10/15/20/30 minutes, using real vintage ads (can be turned off).
- **NostalgiaVue logo animation** at power-on. All sounds are synthesized: relay clicks, degauss thump, static, 15.7 kHz whine and the dial clunk.
- Settings for picture (scanlines, phosphor mask, glass, color), sound, commercials, location, sources and channels. Back up and restore all settings as one file.
- **Classic remote buttons:** SLEEP timer, CC captions, PIP + SWAP, FAV/FAV+ favorites, and **● REC** to tape shows to the **VCR** (channel 880) with VHS tracking lines on playback.
- **Parental controls:** PIN locks by category or channel, and a Kids profile.
- **Realism:** each era changes channels its own way (80s snow and vertical roll, 90s blue mute, 2000s black). A dot lingers when you power off, a hum bar rolls up the screen, the wall glows in the channel's colors and the room darkens at night. On 80s sets you drag the rabbit ears for better reception. Also optional curved glass and an overnight sign-off at 3–5 AM.
- **Your library:** OK on a local channel lists everything in it and resumes where you stopped. The installer can also connect Jellyfin, and settings sync between devices through the Bridge.
- **Nightly YouTube pre-fetch** (GitHub Action) so channel surfing doesn't use the API quota.
- Installs as an app on phones and desktops (PWA). There's a **Windows app** that shows streaming sites inside the set, and TV-remote support for Android TV / Fire TV (see [Desktop & TV Apps](docs/Desktop-and-TV-Apps.md)).

## Run it locally
It's static files, so you don't need a build step:
```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

## Local media & games (Tailscale)
Your drives are shared with the TV through the **NostalgiaVue Bridge** (`bridge/`). It's a small Python server that runs on your PC and is only reachable over your Tailscale network. See [Local Media & the Bridge](docs/Local-Media-and-the-Bridge.md).

## Deploying
The repo deploys to Vercel as a static site plus one function (`api/yt.js`), so you don't need to set a framework or build command. `vercel.json` sets the headers. Set the `YT_API_KEY` environment variable to turn on YouTube search and ON DEMAND (see [Adding Channels](docs/Adding-Channels.md#youtube-api-key)).

## Credits
Programs stream from [archive.org](https://archive.org) and YouTube; NostalgiaVue doesn't host any video. Weather is from [Open-Meteo](https://open-meteo.com). Games run on [EmulatorJS](https://emulatorjs.org).
