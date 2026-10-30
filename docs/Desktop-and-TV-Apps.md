# Desktop & TV Apps

## Windows app
Download **NostalgiaVue-Setup.exe** from the latest release (it's built by the *Windows app* GitHub Action).

It's the same TV in its own window, with **F11** for full screen. It also lets streaming services show **inside the set** on INPUT 2 (channels 501–519): the app strips the "don't show me inside other pages" headers that block them in a browser. Services that use DRM (Netflix, Disney+, Max, Hulu, Prime) still won't play their video, because that needs Google's Widevine module, which isn't licensed for this app. Pluto TV, Tubi, Plex, Twitch, Kanopy and similar work.

## Android TV / Fire TV
NostalgiaVue understands TV remotes: the D-pad, OK, Back, CH+/CH−, the Guide and Info buttons, the color buttons (red = REC, green = Game, yellow = Find, blue = Guide) and CC/Subtitles.

To install it like an app:
1. Go to **https://www.pwabuilder.com** and enter `https://nostalgiavue.vercel.app`.
2. Choose **Android › Generate package** and download the zip (it contains an `.apk`).
3. **Fire TV:** install the *Downloader* app, enable *Install unknown apps* for it, and open the `.apk` from a link (e.g. upload it to Google Drive or a GitHub release).
   **Android TV / Google TV:** sideload the `.apk` with *Send Files to TV* or `adb install`.

## Phones and tablets
See [Install on Mobile](Install-on-Mobile).
