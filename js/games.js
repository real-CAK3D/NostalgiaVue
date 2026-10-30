// Channel 3: the Game Channel. Lists ROMs from your drive (through the Bridge) and runs them
// with EmulatorJS (RetroArch cores compiled for the browser). Works with keyboard, USB/Bluetooth
// controllers, and on phones with the on-screen touch pad.
import { $, esc } from './util.js';
import { state } from './store.js';
import { bridgeApi, bridgeFile, bridgeReady } from './sources/local.js';
import { scene, staticOff, staticOn, msg, hideMsg } from './osd.js';
import { stopVideo } from './player.js';

const SYSTEM_NAMES = {
  nes: 'Nintendo (NES)', snes: 'Super Nintendo', n64: 'Nintendo 64', gb: 'Game Boy', gba: 'Game Boy Advance', nds: 'Nintendo DS',
  segaMD: 'Sega Genesis', segaMS: 'Sega Master System', segaGG: 'Game Gear', segaCD: 'Sega CD', sega32x: 'Sega 32X',
  psx: 'PlayStation', atari2600: 'Atari 2600', atari7800: 'Atari 7800', lynx: 'Atari Lynx', pce: 'TurboGrafx-16',
  ngp: 'Neo Geo Pocket', ws: 'WonderSwan', coleco: 'ColecoVision', vb: 'Virtual Boy', arcade: 'Arcade', mame2003: 'Arcade (MAME)',
};
const g = { games: [], sel: 0, open: false, playing: false, pad: 0, lastPad: 0 };
export const gameState = g;

export async function tuneGames(ch, token) {
  g.open = false; g.playing = false;
  if (!bridgeReady()) {
    staticOff();
    scene(`<div class="card games"><div class="card-name">🎮 THE GAME CHANNEL</div><div class="card-text">Plays the ROMs in your <b>E:\\ROMs</b> folder through the NostalgiaVue Bridge on your PC.<br>Set the Bridge up in <b>MENU › Sources</b> and connect to Tailscale.</div></div>`, 'cardscene');
    return;
  }
  staticOn();
  let j;
  try { j = await bridgeApi('/api/roms'); } catch {
    if (token === state.token) { staticOn(); msg('GAME CONSOLE OFFLINE', 'Can’t reach the Bridge — are you on Tailscale?'); }
    return;
  }
  if (token !== state.token) return;
  staticOff(); hideMsg();
  g.games = (j.games || []).sort((a, b) => a.system.localeCompare(b.system) || a.name.localeCompare(b.name));
  g.sel = 0; g.open = true;
  if (!g.games.length) { scene(`<div class="card games"><div class="card-name">NO CARTRIDGE</div><div class="card-text">The Bridge didn’t find any ROMs. Put them in folders like <b>ROMs\\nes</b>, <b>ROMs\\snes</b>, <b>ROMs\\genesis</b>.</div></div>`, 'cardscene'); return; }
  renderMenu();
  pollPad();
}
function renderMenu() {
  let last = '', html = '';
  g.games.forEach((x, i) => {
    if (x.system !== last) { last = x.system; html += `<div class="gm-sys">${esc(SYSTEM_NAMES[x.core] || x.system)}</div>`; }
    html += `<div class="gm-item${i === g.sel ? ' sel' : ''}" data-i="${i}">${esc(x.name)}</div>`;
  });
  scene(`<div class="gamemenu"><div class="gm-head">🎮 GAME CHANNEL <small>${g.games.length} games · ▲▼ choose · OK play · BACK quit</small></div><div class="gm-list">${html}</div></div>`, 'gamescene');
  const list = $('.gm-list');
  list.onclick = e => { const it = e.target.closest('.gm-item'); if (it) { g.sel = +it.dataset.i; launch(); } };
  list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
}
export function gameNav(d) { if (!g.open || g.playing) return false; g.sel = (g.sel + d + g.games.length) % g.games.length; renderMenu(); return true; }
export function gameOK() { if (!g.open || g.playing) return false; launch(); return true; }
export function gameBack() {
  if (g.playing) { stopGame(); renderMenu(); return true; }
  return false;
}
function launch() {
  const x = g.games[g.sel]; if (!x) return;
  stopVideo(); g.playing = true;
  const f = $('#gameFrame');
  f.hidden = false;
  f.src = `games.html?${new URLSearchParams({ rom: bridgeFile(x.path), core: x.core, name: x.name })}`;
  f.focus();
}
export function stopGame() {
  const f = $('#gameFrame');
  if (!f.hidden) { f.src = 'about:blank'; f.hidden = true; }
  g.playing = false;
}
export function leaveGames() { stopGame(); g.open = false; }

// Controller support for the menu (the emulator handles the pad itself once a game runs).
function pollPad() {
  if (!g.open) return;
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const p = pads[0];
  if (p && !g.playing) {
    const now = performance.now();
    const up = p.buttons[12]?.pressed || p.axes[1] < -.6, down = p.buttons[13]?.pressed || p.axes[1] > .6, a = p.buttons[0]?.pressed;
    if (now - g.lastPad > 180) {
      if (up) { gameNav(-1); g.lastPad = now; } else if (down) { gameNav(1); g.lastPad = now; } else if (a) { gameOK(); g.lastPad = now; }
    }
  }
  requestAnimationFrame(pollPad);
}
