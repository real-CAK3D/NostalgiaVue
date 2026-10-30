// NostalgiaVue — main wiring: power, tuning, remote, keyboard, touch, zoom.
import { $, $$, esc, sleep } from './util.js';
import { settings, save, saveQuiet, state } from './store.js';
import { pullSettings, pushSoon } from './sync.js';
import { buildLineup, CHANNELS, chanByNum, isHidden, sectionOf, SECTIONS, TS } from './lineup.js';
import { initSound, powerOn, powerOff, relay, remoteClick, staticHiss, whine, knobClicks, tunerTick } from './sound.js';
import { staticOn, staticOff, osdChan, osdVol, msg, hideMsg, bug, clearOverlays, splash, infoPanel, banner, barsOff, isStatic, scene } from './osd.js';
import { v, applyVolume, stopProgram, programInfo, showProgramBanner, stopVideo } from './player.js';
import { tuneArchive } from './sources/archive.js';
import { tuneYouTube, stopYouTube, ytActive, title as ytTitle, ytUrl, pickerOpen, openPicker, pickerNav, pickerOK, closePicker, tuneLive, stopLive, learnPlaylistNames } from './sources/youtube.js';
import { tuneLocal, tuneStream, bridgeApi, openLibrary, libraryOpen, libraryNav, libraryOK, closeLibrary } from './sources/local.js';
import { tuneWeather, tuneGuideChannel, tuneCard, tuneBars, openExternal, watchOnTV, webActive, stopWeb } from './sources/special.js';
import { tuneGames, gameNav, gameOK, gameBack, leaveGames, gameState } from './games.js';
import { openGuide, closeGuide, guideMove, guidePage, guideSelected, bindGuide, cycleGuideStyle } from './guide.js';
import { openMenu, closeMenu, bindMenu, menuNav, renderMenu } from './menu.js';
import { renderSet, turnDial, irBlink, era, setId, SETS } from './sets.js';
import { runBreak } from './ads.js';
import { sleepButton, ccButton, favToggle, favNext, pipButton, pipSwap, pipRender, pipClose, recButton, tuneVCR, vcrNav, vcrOK, vcrBack, leaveVCR, vcrState } from './extras.js';
import { roomFor, updateReception, bindAntenna, reaimEars, installWarp } from './look.js';
import { isLocked, showLock, pinDigit, cancelPin, clearUnlocks, kidsHidden } from './parental.js';
import { iconSVG } from './icons.js';
import './ads.js';

// Pairing link from the Bridge installer: #pair=<base64 {"u": bridge url, "t": token}>
async function pairFromLink() {
  const m = location.hash.match(/pair=([A-Za-z0-9+/=_-]+)/); if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const { u, t, ju, jk } = JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!/^https:\/\//.test(u)) return;
    settings.bridgeUrl = u; settings.bridgeToken = t || '';
    if (ju && jk && /^https:\/\//.test(ju)) { settings.jellyfinUrl = ju; settings.jellyfinKey = jk; }
    save();
    // first pairing: fill the local channels with Movies, the whole TV library, then one show per channel
    if (!Object.keys(settings.localMap).length) {
      const { dirs = [] } = await bridgeApi('/api/browse', { depth: 2 });
      const slots = SECTIONS.find(x => x.id === 'local').nums, map = {};
      const pick = [...dirs.filter(d => !d.includes('/')), ...dirs.filter(d => d.split('/').length === 2 && /^TV\//.test(d))];
      pick.slice(0, slots.length).forEach((path, i) => { map[slots[i]] = { type: 'bridge', path, label: path === 'TV' ? 'All TV Shows' : path.split('/').pop() }; });
      settings.localMap = map; save();
    }
    buildLineup();
    pairedNote = `Connected to your PC. Local channels: ${Object.keys(settings.localMap).join(', ')}`;
  } catch { pairedNote = 'That pairing link didn’t work. Re-run the installer, or enter the Bridge in MENU › Sources.'; }
}
let pairedNote = '';
await pairFromLink();
state.hooks.onSave = () => pushSoon();
state.hooks.saveQuiet = () => saveQuiet();
// shared setup from the Bridge (if this device was set up longer ago than another one)
if (await Promise.race([pullSettings(), sleep(2500).then(() => false)])) { /* applied below */ }
buildLineup();
if (!chanByNum(state.num)) state.num = 31;
// name playlist channels after their real YouTube titles
learnPlaylistNames(CHANNELS.flatMap(c => c.kind === 'yt' && c.autoName ? c.yt : [])).then(ok => { if (ok) buildLineup(); }).catch(() => {});

/* ---------- applying settings to the picture ---------- */
let renderedSet = '';
function apply() {
  const s = $('#screen').style;
  s.setProperty('--scan', settings.scanlines / 100);
  s.setProperty('--mask', settings.mask / 100);
  s.setProperty('--curve', settings.curvature / 100);
  $('#prog').style.filter = `saturate(${settings.color}%) brightness(${settings.brightness}%)`;
  document.body.classList.toggle('no-remote', !settings.remote);
  document.body.classList.toggle('zoom', !!settings.zoom);
  if (renderedSet !== setId()) { renderedSet = setId(); renderSet(); }
  applyVolume(); whine(state.on);
  document.body.classList.toggle('no-hum', !settings.humBar);
  document.body.classList.toggle('warp', !!settings.warp);
  if (settings.warp) installWarp();
  roomFor(chanByNum(state.num)); reaimEars(); updateReception();
  turnDial();
}
state.hooks.apply = apply;
state.hooks.lineupChanged = () => { if (state.on && !chanByNum(state.num)) tune(31); };
state.hooks.breakNow = () => runBreak(true);
// a new era retunes the current channel so it shows something from those years
state.hooks.eraChanged = () => { const ch = chanByNum(state.num); if (state.on && ch && (ch.kind === 'archive' || ch.kind === 'yt')) tune(state.num); };
state.hooks.fullscreen = fullscreen;
state.hooks.card = ch => tuneCard(ch);
state.hooks.power = () => { if (state.on) power(); };
state.hooks.namesLearned = () => buildLineup();

/* ---------- tuning ---------- */
function stopAll() {
  stopProgram(); stopYouTube(); stopLive(); leaveGames(); leaveVCR(); closeLibrary(); stopWeb(); barsOff();
  document.getElementById('prog').classList.remove('vhs');
  v.hidden = false;
}
export async function tune(n, { silent } = {}) {
  if (!state.on) return;
  if (n !== state.num) { state.prev = state.num; state.num = n; settings.num = n; save(); }
  const token = ++state.token;
  state.inBreak = false;
  const from = state.prev ?? n;
  stopAll(); clearOverlays(); staticOn();
  // the sound of the tuner: rotary detents on 80s sets, a relay tick on 90s sets, near-silent on 2000s sets
  if (silent !== 'power') { if (era() === '80s') knobClicks(Math.abs(n - from) || 1); else if (era() === '90s') tunerTick(); else relay(); }
  const ch = chanByNum(n);
  osdChan(ch);
  bug(ch); turnDial(); roomFor(ch); updateReception(); pipRender();
  if (state.guide) closeGuide();
  if (!ch) { msg('NO SIGNAL'); return; }
  cancelPin();
  if (kidsHidden(ch) || isLocked(ch)) { showLock(ch, () => tune(n, { silent })); return; }
  await sleep(250 + Math.random() * 250); // the tuner hunting for a signal
  if (token !== state.token) return;
  // 3–5 AM: the classic cable channels sign off with vintage sign-offs and anthems, like old TV
  const hr = new Date().getHours();
  if (settings.signOff && (hr === 3 || hr === 4) && ch.kind === 'archive' && ch.n >= 31 && ch.n <= 200 && !ch.custom) {
    return tuneArchive({ ...ch, q: [TS('sign off', 'sign-off', 'station sign off', 'national anthem', 'end of broadcast day')], audio: false, rows: 120 }, token);
  }
  switch (ch.kind) {
    case 'archive': return tuneArchive(ch, token);
    case 'yt':
      if (ch.ppvEvent) {
        staticOff();
        scene(`<div class="card ppv"><div class="ppv-head">PAY-PER-VIEW · ORDER CONFIRMED</div><div class="card-icon">${iconSVG(ch)}</div>
          <div class="card-name">${esc(ch.name)}</div><div class="card-text">$0.00 · billed to your imagination<br>Your event begins in a moment…</div></div>`, 'cardscene');
        await sleep(2800);
        if (token !== state.token) return;
        clearOverlays(); staticOn();
      }
      return tuneYouTube(ch, token);
    case 'local': return tuneLocal(ch, token);
    case 'stream': return tuneStream(ch, token);
    case 'weather': return tuneWeather(ch, token);
    case 'guidech': return tuneGuideChannel(ch, token);
    case 'games': return tuneGames(ch, token);
    case 'bars': return tuneBars();
    case 'ytlive': return tuneLive(ch, token);
    case 'vcr': return tuneVCR(ch, token);
    case 'station': case 'external': return tuneCard(ch);
  }
  msg('NO SIGNAL');
}
state.hooks.tune = tune;

function step(d) {
  const list = CHANNELS.filter(c => !isHidden(c.n)).map(c => c.n);
  const n = d > 0 ? (list.find(x => x > state.num) ?? list[0]) : ([...list].reverse().find(x => x < state.num) ?? list[list.length - 1]);
  tune(n);
}
function vol(d) {
  settings.muted = false; settings.vol = Math.max(0, Math.min(1, Math.round((settings.vol + d) * 20) / 20));
  applyVolume(); osdVol(); turnDial(); save(); if (isStatic()) staticHiss(true);
}
function mute() { settings.muted = !settings.muted; applyVolume(); osdVol(); save(); staticHiss(isStatic()); whine(state.on); }

let digitTimer = 0;
function digit(d) {
  if (!state.on || state.menu) return;
  if (pinDigit(d)) return;
  state.digits += d;
  osdChan(null, state.digits + '-'.repeat(3 - state.digits.length));
  clearTimeout(digitTimer);
  const commit = () => { const n = parseInt(state.digits, 10); state.digits = ''; if (n > 0) tune(n); };
  if (state.digits.length >= 3) commit(); else digitTimer = setTimeout(commit, 1600);
}

function info() {
  const ch = chanByNum(state.num); if (!ch) return;
  if ($('#info').classList.contains('show')) { $('#info').classList.remove('show'); return; }
  let title = ch.name, body = '', link = '';
  if (ytActive()) { title = ytTitle() || ch.name; body = `${ch.name} on YouTube.`; link = ytUrl(); banner({ ch, title, sub: ch.name + ' · YouTube' }, 9000); }
  else if (programInfo()) { const p = programInfo(); title = p.title; body = p.desc; link = p.link; showProgramBanner(9000); }
  else { body = ch.desc || ''; link = ch.url || ''; }
  infoPanel(`<div class="info-head">${iconSVG(ch)}<div><h3>${esc(title)}</h3><small>CH ${ch.n} · ${esc(ch.name)} · ${esc(sectionOf(ch.n)?.label || '')}</small></div></div>
    <p>${esc((body || 'No description.').slice(0, 900))}${body.length > 900 ? '…' : ''}</p>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">More info ↗</a>` : ''}`);
}

/* ---------- power ---------- */
async function power() {
  initSound();
  const set = $('#set');
  if (!state.on) {
    state.on = true; set.classList.remove('off-anim'); set.classList.add('on');
    unlockMedia(); powerOn(era()); applyVolume();
    // the tube warms up into snow before the picture locks in
    await sleep(era() === '00s' ? 350 : 650);
    if (!state.on) return;
    if (era() !== '00s') { staticOn(); await sleep(900); staticOff(); }
    await splash();
    if (state.on) tune(state.num, { silent: 'power' });
    if (pairedNote) { const n = pairedNote; pairedNote = ''; setTimeout(() => infoPanel(`<h3>📡 NostalgiaVue Bridge</h3><p>${esc(n)}</p>`, 8000), 2500); }
  } else {
    state.on = false; state.token++; clearUnlocks(); cancelPin(); pipClose(); state.sleepAt = 0;
    closeGuide(); closeMenu(); stopAll(); staticOff(); clearOverlays(); powerOff(era());
    set.classList.remove('on'); set.classList.add('off-anim'); updateReception();
    if (era() !== '00s') { const d = $('#dot'); d.classList.remove('go'); void d.offsetWidth; d.classList.add('go'); }
    setTimeout(() => set.classList.remove('off-anim'), 600);
  }
}
// Start a silent clip inside the click so later play() calls are allowed (iOS Safari).
function unlockMedia() {
  const n = 800, b = new ArrayBuffer(44 + n * 2), d = new DataView(b), w = (o, s) => [...s].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
  d.setUint32(24, 8000, true); d.setUint32(28, 16000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, n * 2, true);
  v.src = URL.createObjectURL(new Blob([b], { type: 'audio/wav' })); v.play().catch(() => {});
}

/* ---------- zoom / fullscreen ---------- */
function toggleZoom() { settings.zoom = !settings.zoom; save(); apply(); }
function fullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen?.();
  else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
}

/* ---------- remote actions ---------- */
async function act(a) {
  irBlink(); initSound(); remoteClick(era());
  if (a === 'power') return power();
  if (a === 'zoom') return toggleZoom();
  if (!state.on) return;
  // the menu swallows navigation keys
  if (state.menu) {
    if (['up', 'down', 'left', 'right', 'ok'].includes(a)) return menuNav(a);
    if (a === 'menu' || a === 'back') return closeMenu();
  }
  if (state.guide) {
    if (a === 'up' || a === 'chup') return guideMove(-1);
    if (a === 'down' || a === 'chdn') return guideMove(1);
    if (a === 'left') return guidePage(-1);
    if (a === 'right') return guidePage(1);
    if (a === 'ok') { const ch = guideSelected(); closeGuide(); return tune(ch.n); }
    if (a === 'guide' || a === 'back') return closeGuide();
    if (a === 'info') { const name = cycleGuideStyle(); osdChan(null, name.split(' (')[0]); return; }
  }
  if (pickerOpen()) {
    if (a === 'up' || a === 'chup') return pickerNav(-1);
    if (a === 'down' || a === 'chdn') return pickerNav(1);
    if (a === 'ok') return pickerOK();
    if (a === 'back' || a === 'guide') return closePicker();
  }
  if (libraryOpen()) {
    if (a === 'up' || a === 'chup') return libraryNav(-1);
    if (a === 'down' || a === 'chdn') return libraryNav(1);
    if (a === 'ok') return libraryOK();
    if (a === 'back') return closeLibrary();
  }
  if (vcrState.open) {
    if ((a === 'up' || a === 'chup') && vcrNav(-1)) return;
    if ((a === 'down' || a === 'chdn') && vcrNav(1)) return;
    if (a === 'ok' && vcrOK()) return;
    if (a === 'back' && vcrBack()) return;
  }
  if (gameState.open) {
    if (a === 'up' && gameNav(-1)) return;
    if (a === 'down' && gameNav(1)) return;
    if (a === 'ok' && gameOK()) return;
    if (a === 'back' && gameBack()) return;
  }
  const ch = chanByNum(state.num);
  switch (a) {
    case 'chup': case 'up': return step(1);
    case 'chdn': case 'down': return step(-1);
    case 'volup': case 'right': return vol(.05);
    case 'voldn': case 'left': return vol(-.05);
    case 'mute': return mute();
    case 'guide': return openGuide();
    case 'info': return info();
    case 'menu': return openMenu();
    case 'last': if (state.prev != null) tune(state.prev); return;
    case 'ppv': return tune(500);
    case 'sleep': return sleepButton();
    case 'cc': return ccButton();
    case 'pip': return pipButton();
    case 'swap': return pipSwap();
    case 'fav': return favNext();
    case 'favadd': return favToggle();
    case 'rec': return recButton();
    case 'vcr': return tune(880);
    case 'games': return tune(3);
    case 'find': return openMenu('channels');
    case 'back': if (webActive()) { stopWeb(); return tuneCard(ch); } clearOverlays(); return;
    case 'ok':
      if (ch && (ch.kind === 'external' || ch.kind === 'station') && ch.url) return webActive() ? openExternal(ch) : watchOnTV(ch);
      if (ch && ch.kind === 'ytlive') return tune(ch.from);
      if (ch && ch.kind === 'local' && await openLibrary(ch)) return;
      if (ytActive() && openPicker()) return;
      if (programInfo() && !$('#msg').classList.contains('tap')) return showProgramBanner();
      if ($('#msg').classList.contains('tap')) return $('#msg').click();
      return;
  }
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act],[data-d]');
  if (!b || b.closest('#menu')) return;
  if (b.dataset.d != null) { irBlink(); remoteClick(era()); digit(b.dataset.d); }
  else act(b.dataset.act);
});

document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select') && e.key !== 'Escape') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (/^[0-9]$/.test(k)) { irBlink(); remoteClick(era()); return digit(k); }
  const map = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', ' ': 'ok',
    PageUp: 'chup', PageDown: 'chdn', '+': 'volup', '=': 'volup', '-': 'voldn',
    g: 'guide', i: 'info', m: 'mute', l: 'last', p: 'power', s: 'menu', z: 'zoom', f: 'find', Escape: 'back', Backspace: 'back',
    x: 'sleep', c: 'cc', n: 'pip', w: 'swap', v: 'fav', b: 'favadd', r: 'rec',
    // TV remotes (Android TV / Fire TV / smart-TV browsers)
    ChannelUp: 'chup', ChannelDown: 'chdn', MediaPlayPause: 'ok', GoBack: 'back', BrowserBack: 'back', Info: 'info', Guide: 'guide',
    ColorF0Red: 'rec', ColorF1Green: 'games', ColorF2Yellow: 'find', ColorF3Blue: 'guide', MediaRecord: 'rec', Subtitle: 'cc', ClosedCaptionToggle: 'cc',
  };
  const a = map[k] || map[k.toLowerCase()];
  if (a) { e.preventDefault(); act(a); }
});

// Swipe up/down on the glass to flip channels.
let touch = null;
$('#screen').addEventListener('touchstart', e => { touch = { y: e.touches[0].clientY, x: e.touches[0].clientX }; }, { passive: true });
$('#screen').addEventListener('touchend', e => {
  if (!touch || !state.on || state.menu || state.guide || gameState.playing) return;
  const dy = e.changedTouches[0].clientY - touch.y, dx = e.changedTouches[0].clientX - touch.x; touch = null;
  if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) step(dy < 0 ? 1 : -1);
  else if (Math.abs(dx) > 60) vol(dx > 0 ? .1 : -.1);
}, { passive: true });

// In zoom mode the control bar appears when you move or tap, then fades.
let zoomTimer = 0;
['mousemove', 'touchstart'].forEach(ev => document.addEventListener(ev, () => {
  if (!settings.zoom) return;
  document.body.classList.add('zoom-ui'); clearTimeout(zoomTimer);
  zoomTimer = setTimeout(() => document.body.classList.remove('zoom-ui'), 2500);
}, { passive: true }));

bindGuide(ch => { closeGuide(); tune(ch.n); });
bindMenu();
renderSet();
bindAntenna();
apply();

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
