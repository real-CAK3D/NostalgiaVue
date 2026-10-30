# Game Channel (3)

Channel 3 lists the ROMs in your **ROMs** folder (via the [Bridge](Local-Media-and-the-Bridge)). It plays them in the browser with **EmulatorJS**, which runs RetroArch cores compiled for the web.

## Folder layout
Put each system in its own folder under the `roms` path from `config.json`:
```
E:\ROMs\nes\        .nes
E:\ROMs\snes\       .sfc .smc
E:\ROMs\n64\        .z64 .n64 .v64
E:\ROMs\gb\  gbc\   .gb .gbc
E:\ROMs\gba\        .gba
E:\ROMs\nds\        .nds
E:\ROMs\genesis\    .md .gen .smd
E:\ROMs\sms\  gamegear\
E:\ROMs\psx\        .cue (+ .bin) .chd .pbp
E:\ROMs\atari2600\  pce\  ngp\  ws\  coleco\  vb\  arcade\
```
`.zip` files work when they're inside a system folder. Folder names are flexible: `genesis`, `megadrive` and `md` all work.

## Playing
- **Remote / keyboard:** ▲▼ choose, OK play, BACK quit to the list.
- **Controllers:** plug in a USB pad, or pair a Bluetooth one (Xbox, PlayStation, 8BitDo). It drives the game list and the game.
- **Phones:** EmulatorJS shows an on-screen touch gamepad automatically. A Bluetooth controller paired to the phone also works.
- EmulatorJS's own menu (bottom bar inside the game) has save states, controls and full screen.

You need your own legally obtained ROMs; NostalgiaVue doesn't supply any.
