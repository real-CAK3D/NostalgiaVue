// Ambient realism: wall glow, night-time room, rabbit-ear reception, and the curved-glass warp.
import { $, hash } from './util.js';
import { settings, save, state } from './store.js';
import { reception } from './osd.js';
import { CAT_HUE } from './icons.js';
import { setId } from './sets.js';

/* the wall glows in the color of what's on, and the room dims after dark */
export function roomFor(ch) {
  document.body.style.setProperty('--gh', ch ? (CAT_HUE[ch.cat] ?? 220) : 220);
  document.body.classList.toggle('no-glow', !settings.glow);
  const h = new Date().getHours();
  document.body.classList.toggle('night', settings.glow && (h >= 21 || h < 6));
}

/* rabbit ears: each channel comes in best at its own antenna angle */
const hasAntenna = () => ['80s-console', '80s-portable'].includes(setId());
export function updateReception() {
  if (!state.on || !settings.reception || !hasAntenna()) return reception(1);
  const n = state.num, best = (hash(n, 77) % 100) - 50, a = settings.antenna || 0;
  const align = 1 - Math.min(1, Math.abs(a - best) / 55);
  const q = Math.min(1, .55 + align * .5 - (n > 13 ? .06 : 0));
  reception(q);
}
function aimEars(a) {
  const l = document.querySelector('.ear.l'), r = document.querySelector('.ear.r'), w = document.querySelector('.whip');
  if (l) l.style.transform = `rotate(${-32 + a * .6}deg)`;
  if (r) r.style.transform = `rotate(${27 + a * .6}deg)`;
  if (w) w.style.transform = `rotate(${28 + a * .8}deg)`;
}
export function bindAntenna() {
  aimEars(settings.antenna || 0);
  let drag = null;
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.ear, .whip')) return;
    e.preventDefault(); drag = { x: e.clientX, a: settings.antenna || 0 };
    e.target.setPointerCapture?.(e.pointerId);
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    settings.antenna = Math.max(-60, Math.min(60, drag.a + (e.clientX - drag.x) / 2));
    aimEars(settings.antenna); updateReception();
  });
  document.addEventListener('pointerup', () => { if (drag) { drag = null; save(); } });
}
export const reaimEars = () => aimEars(settings.antenna || 0);

/* curved glass: an SVG displacement map that bulges the picture like a real tube */
export function installWarp() {
  if (document.getElementById('crtWarp')) return;
  const W = 256, c = document.createElement('canvas'); c.width = c.height = W;
  const x = c.getContext('2d'), d = x.createImageData(W, W);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const u = i / (W - 1) * 2 - 1, v = j / (W - 1) * 2 - 1, r2 = u * u + v * v, k = (o, t) => 128 + o * t * 127;
    const p = (j * W + i) * 4;
    d.data[p] = k(-u, r2 * .5); d.data[p + 1] = k(-v, r2 * .5); d.data[p + 2] = 128; d.data[p + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
  svg.innerHTML = `<filter id="crtWarp" x="0" y="0" width="1" height="1" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
    <feImage href="${c.toDataURL()}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="m"/>
    <feDisplacementMap in="SourceGraphic" in2="m" scale=".06" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  document.body.appendChild(svg);
}
