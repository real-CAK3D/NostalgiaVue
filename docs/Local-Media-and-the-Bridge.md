# Local Media & the Bridge

Channels **1, 2, 4, 5, 7, 11 and 14–20** play your own videos and music. Channel **3** plays your ROMs. They work in two ways, and both only work while you're on your **Tailscale** network.

## Option A: the NostalgiaVue Bridge (your E: drive)
The Bridge is a small Python program in [`bridge/`](https://github.com/real-CAK3D/NostalgiaVue/tree/main/bridge) that shares folders you choose.

1. Install **Python 3** (python.org; tick *Add to PATH*) and **Tailscale** on the PC that has the E: drive.
2. Copy the `bridge` folder to that PC. Run `start-bridge.bat` once; it creates `config.json`.
3. Edit `config.json`:
   ```json
   {
     "name": "Living Room PC",
     "port": 8787,
     "token": "pick-a-long-random-word",
     "media": { "Videos": "E:/Videos", "TV": "E:/TV Shows", "Music": "E:/Music" },
     "roms": "E:/ROMs",
     "allow_origins": ["https://nostalgiavue.vercel.app"]
   }
   ```
4. Run `start-bridge.bat` again. It also runs `tailscale serve --bg 8787`, which gives the Bridge an address like `https://living-room-pc.tail1234.ts.net` (shown by `tailscale serve status`).
   - The `https://` address matters: the app is served over https, and browsers block plain `http://` media inside an https page.
   - If `tailscale serve` asks you to enable HTTPS certificates, turn on *MagicDNS* and *HTTPS* in the Tailscale admin console under DNS.
5. In NostalgiaVue: **MENU › Sources**. Enter the Bridge address and token, then press **Test & load folders**.
6. Under **Local channels**, pick a folder for each channel number (or type one, like `Videos/Cartoons`), then **Save**.

Each local channel shuffles its folder into the same half-hour schedule as everything else. If `ffprobe` (part of FFmpeg) is installed, the Bridge learns each file's length so tuning in lands mid-show.

**Formats:** browsers play `.mp4` (H.264/AAC), `.webm` and `.mp3` everywhere. `.mkv` works in Chrome and Edge when the video inside is H.264. For anything else, use Jellyfin (below), which converts on the fly.

**Security:** the Bridge listens only on `127.0.0.1`, so only `tailscale serve` exposes it, and only to your tailnet. It needs the token, and it refuses paths outside the folders you configured.

## Option B: Jellyfin
1. In Jellyfin: *Dashboard › API Keys › +*. Copy the key.
2. Reach Jellyfin over Tailscale with https (`tailscale serve --bg 8096` on the Jellyfin machine).
3. **MENU › Sources › Jellyfin**: enter the address and key, then press **Test & load libraries**.
4. Choose a library for any local channel and **Save**. Video is converted to HLS (H.264) by Jellyfin, so any format plays.
