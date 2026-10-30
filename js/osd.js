// Everything drawn on the glass that isn't the program itself: snow, OSD, banners, messages.
import { watchingNow } from './stats.js';
import { $, esc, pad, fmtTime, slotNow, SLOT } from './util.js';
import { settings, state } from './store.js';
import { staticHiss, tone, chime } from './sound.js';
import { iconSVG } from './icons.js';
import { emblem, wordmark } from './logo.js';
import { era } from './sets.js';

/* ---------- snow ---------- */
const snow = $('#snow'), sctx = snow.getContext('2d'), W = 160, H = 120;
const simg = sctx.createImageData(W, H), s32 = new Uint32Array(simg.data.buffer);
let snowOn = false, raf = 0, roll = 0;
function drawSnow() {
  roll = (roll + 2.5) % H;
  for (let y = 0; y < H; y++) {
    const band = Math.abs(y - roll) < 7 ? 45 : 0, row = y * W;
    for (let x = 0; x < W; x++) { const g = Math.min(255, (Math.random() * 235 | 0) + band); s32[row + x] = 0xff000000 | g << 16 | g << 8 | g; }
  }
  sctx.putImageData(simg, 0, 0);
  if (snowOn) raf = requestAnimationFrame(drawSnow);
}
// Between channels each era looked different: 80s sets showed snow and the picture rolled,
// 90s sets muted to a blue screen, 2000s sets just went black. (MENU › Picture › Channel change.)
function changeLook() {
  const m = settings.changeFx || 'era';
  if (m !== 'era') return m;
  return { '80s': 'roll', '90s': 'blue', '00s': 'black' }[era()] || 'snow';
}
export function staticOn(sound = true) {
  const look = changeLook(), mute = $('#mute');
  snowOn = true;
  if (look === 'blue' || look === 'black') {
    mute.className = look; mute.hidden = false; snow.hidden = true; staticHiss(false);
    if (look === 'blue') mute.innerHTML = `<span>${era() === '90s' ? 'CH ' + state.num : ''}</span>`; else mute.innerHTML = '';
  } else {
    mute.hidden = true; snow.hidden = false; if (sound) staticHiss(true);
    cancelAnimationFrame(raf); drawSnow();
  }
  const t = $('#tube'), cls = look === 'roll' ? 'roll' : 'jolt';
  t.classList.remove('jolt', 'roll'); void t.offsetWidth; t.classList.add(cls);
}
export function staticOff() { snowOn = false; cancelAnimationFrame(raf); snow.hidden = true; $('#mute').hidden = true; staticHiss(false); }
export const isStatic = () => snowOn;

/* ---------- reception: weak channels get snow and ghosts until you aim the rabbit ears ---------- */
let noiseURL = '';
function noiseTile() {
  if (noiseURL) return noiseURL;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), d = x.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const g = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = g; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); return noiseURL = c.toDataURL();
}
export function reception(q) {
  // q: 1 = perfect picture, 0 = barely there
  const r = $('#rx'), prog = $('#prog');
  if (q >= .97) { r.hidden = true; prog.style.removeProperty('--ghost'); return; }
  r.style.backgroundImage = `url(${noiseTile()})`; r.style.opacity = ((1 - q) * .55).toFixed(2); r.hidden = false;
  prog.style.setProperty('--ghost', `${(1 - q) * 1.6}cqw`);
}

/* ---------- bars & tone ---------- */
export function bars(big, small, withTone = false) {
  staticOff(); $('#bars').hidden = false; tone(withTone);
  if (big) msg(big, small); else hideMsg();
}
export function barsOff() { $('#bars').hidden = true; tone(false); }

/* ---------- flashing overlays ---------- */
const timers = {};
export function flash(el, ms = 3000) {
  el.classList.add('show'); clearTimeout(timers[el.id]);
  if (ms) timers[el.id] = setTimeout(() => el.classList.remove('show'), ms);
}
export function hide(el) { el.classList.remove('show'); clearTimeout(timers[el.id]); }

export function osdChan(ch, text) {
  const el = $('#osdChan');
  if (text) el.innerHTML = `<b>${esc(text)}</b>`;
  else el.innerHTML = `<b>${state.num}</b><span>${esc(ch ? ch.call : '')}</span>`;
  el.dataset.style = era();
  flash(el, text ? 2000 : 3500);
}
export function osdVol() {
  const n = Math.round(settings.vol * 20), el = $('#osdVol');
  el.dataset.style = era();
  el.innerHTML = settings.muted ? '<b>MUTE</b>' : `<b>VOLUME</b> <span class="seg">${'▮'.repeat(n)}${'▯'.repeat(20 - n)}</span> <i>${pad(n)}</i>`;
  flash(el, 2200);
}
export function msg(big, small, opts = {}) {
  const m = $('#msg');
  m.innerHTML = `<b>${esc(big)}</b>${small ? `<span>${esc(small)}</span>` : ''}${opts.button ? `<button type="button" class="msg-btn">${esc(opts.button)}</button>` : ''}`;
  m.className = 'show' + (opts.tap ? ' tap' : '');
  m.onclick = opts.onTap || null;
}
export function hideMsg() { const m = $('#msg'); m.className = ''; m.onclick = null; }

export function banner({ ch, title, sub, extra }, ms = 5000) {
  if (!ch) return;
  const { start } = slotNow(), pct = Math.min(100, (Date.now() - start) / SLOT * 100), h24 = settings.clock24;
  $('#banner').innerHTML = `<div class="b-icon">${iconSVG(ch)}</div><div class="b-body">
    <div class="b-top"><span class="b-ch">${ch.n} ${esc(ch.call)}</span><span class="b-name">${esc(ch.name)}</span><span class="b-time">${fmtTime(start, h24)} – ${fmtTime(start + SLOT, h24)}</span>${watchingNow(ch.n) ? `<span class="b-watch">👁 ${watchingNow(ch.n)}</span>` : ''}</div>
    <div class="b-title">${esc(title || ch.name)}</div><div class="b-sub">${esc(sub || '') || '&nbsp;'}</div>
    <div class="b-prog"><i style="width:${pct}%"></i></div>${extra || ''}</div>`;
  flash($('#banner'), ms);
}
export function infoPanel(html, ms = 12000) { const b = $('#info'); b.innerHTML = html; flash(b, ms); }
const NOBUG = new Set(['guidech', 'weather', 'games', 'station', 'external', 'bars', 'vcr']);
export function bug(ch) {
  const b = $('#bug');
  b.innerHTML = ch && !NOBUG.has(ch.kind) ? iconSVG(ch) : '';
}

/* ---------- scene layer (radio art, cards, weather, menus...) ---------- */
export function scene(html, cls = '') { const s = $('#scene'); s.className = cls; s.innerHTML = html; s.hidden = !html; return s; }
export function clearScene() { scene(''); }

/* ---------- power-on brand splash ---------- */
export function splash() {
  return new Promise(res => {
    if (!settings.logoIntro) return res();
    const s = $('#splash');
    s.innerHTML = `<div class="sp-emblem">${emblem('sp')}</div><div class="sp-word">${wordmark('color', 'spw')}</div><div class="sp-tag">THE PICTURE OF YESTERDAY</div>`;
    s.hidden = false; s.classList.remove('go'); void s.offsetWidth; s.classList.add('go');
    setTimeout(chime, 250);
    setTimeout(() => { s.classList.add('out'); }, 2000);
    setTimeout(() => { s.hidden = true; s.classList.remove('go', 'out'); res(); }, 2500);
  });
}

export function clearOverlays() {
  ['#banner', '#info', '#osdChan', '#osdVol'].forEach(q => hide($(q)));
  hideMsg(); barsOff(); clearScene();
}
