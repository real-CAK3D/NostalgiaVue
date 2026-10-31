// Generated station logos. Every channel (including ones you add later) gets a
// deterministic SVG badge built from its call letters, category and number.
import { hash, esc } from './util.js';

export const CAT_HUE = {
  'LOCAL MEDIA': 140, GAMES: 280, 'LOCAL TV': 210, GUIDE: 220, SHOPPING: 320, COMEDY: 45, CRIME: 0, SCIENCE: 175,
  GAMING: 270, MOVIES: 355, SPORTS: 120, LIFESTYLE: 30, NEWS: 205, WESTERN: 25, DRAMA: 300, 'SCI-FI': 190, CARTOONS: 50,
  KIDS: 85, 'GAME SHOWS': 330, TALK: 260, HORROR: 15, SEASONAL: 100, MUSIC: 290, RADIO: 35, LEARNING: 160, 'ADS & TV': 340,
  ARCHIVES: 40, WORLD: 150, YOUTUBE: 0, PODCASTS: 265, PPV: 48, BYO: 195, YOURS: 195,
  'CLASSIC TV': 215, SITCOMS: 60, NATURE: 110, OUTDOORS: 95, EXTREME: 10, 'HALF BAKED': 130, 'AFTER DARK': 330, XXX: 345, DOCS: 25, MAKER: 165, 'ADULT SWIM': 0, 'MTV': 300, LIVE: 350, PLAYLISTS: 230, TALKS: 245, COZY: 22, VCR: 200,
};
const FONTS = ["'Bungee'", "'Righteous'", "'Bebas Neue'", "'Rubik Mono One'", "'Lobster'", "'Press Start 2P'", "'Oswald'", "'Monoton'"];
const SHAPES = ['disc', 'shield', 'box', 'tv', 'burst', 'pill', 'diamond', 'stripes'];

function hsl(h, s, l) { return `hsl(${(h + 360) % 360} ${s}% ${l}%)`; }

function shapePath(kind, r) {
  switch (kind) {
    case 'disc': return `<circle cx="50" cy="50" r="46" fill="${r.bg}" stroke="${r.rim}" stroke-width="5"/><circle cx="50" cy="50" r="38" fill="none" stroke="${r.hi}" stroke-width="1.5" opacity=".7"/>`;
    case 'shield': return `<path d="M50 4 L92 16 V48 C92 74 72 90 50 97 C28 90 8 74 8 48 V16 Z" fill="${r.bg}" stroke="${r.rim}" stroke-width="5"/>`;
    case 'box': return `<rect x="5" y="14" width="90" height="72" rx="12" fill="${r.bg}" stroke="${r.rim}" stroke-width="5"/><path d="M5 62 L95 38 V54 L5 78Z" fill="${r.hi}" opacity=".35"/>`;
    case 'tv': return `<path d="M30 6 L50 22 L70 6" stroke="${r.rim}" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="6" y="22" width="88" height="68" rx="16" fill="${r.bg}" stroke="${r.rim}" stroke-width="5"/>`;
    case 'burst': {
      let d = ''; for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, rr = i % 2 ? 36 : 48; d += `${i ? 'L' : 'M'}${(50 + rr * Math.cos(a)).toFixed(1)} ${(50 + rr * Math.sin(a)).toFixed(1)} `; }
      return `<path d="${d}Z" fill="${r.bg}" stroke="${r.rim}" stroke-width="4" stroke-linejoin="round"/>`;
    }
    case 'pill': return `<rect x="3" y="24" width="94" height="52" rx="26" fill="${r.bg}" stroke="${r.rim}" stroke-width="5"/>`;
    case 'diamond': return `<path d="M50 3 L97 50 L50 97 L3 50Z" fill="${r.bg}" stroke="${r.rim}" stroke-width="5" stroke-linejoin="round"/>`;
    default: return `<rect x="5" y="10" width="90" height="80" rx="8" fill="${r.bg}" stroke="${r.rim}" stroke-width="5"/>` +
      [0, 1, 2].map(i => `<rect x="5" y="${62 + i * 8}" width="90" height="5" fill="${hsl(r.h + i * 30, 85, 55)}"/>`).join('');
  }
}

const cache = new Map();
export function iconSVG(ch) {
  const call = String(ch.call || ch.n).slice(0, 5);
  const key = `${ch.n}|${call}|${ch.cat}|${ch.icon || ''}`;
  if (cache.has(key)) return cache.get(key);
  const h0 = hash(call, ch.n), h = (CAT_HUE[ch.cat] ?? (h0 % 360)) + (h0 % 30) - 15;
  const shape = ch.icon || SHAPES[h0 % SHAPES.length];
  const font = FONTS[(h0 >>> 5) % FONTS.length];
  const dark = (h0 >>> 9) % 3 === 0;
  const r = { h, bg: dark ? hsl(h, 55, 16) : hsl(h, 75, 46), rim: dark ? hsl(h, 80, 60) : hsl(h, 60, 92), hi: hsl(h + 40, 90, 75) };
  const ink = dark ? hsl(h, 90, 72) : '#fff';
  const small = /Press Start|Monoton|Rubik/.test(font);
  const size = (call.length <= 2 ? 40 : call.length === 3 ? 32 : call.length === 4 ? 25 : 20) * (small ? .78 : 1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${shapePath(shape, r)}
<text x="50" y="${shape === 'tv' ? 60 : 52}" text-anchor="middle" dominant-baseline="middle" font-family="${font},Impact,sans-serif" font-size="${size}" fill="${ink}" stroke="rgba(0,0,0,.45)" stroke-width="${dark ? 0 : 1.2}" paint-order="stroke" ${call.length > 3 ? 'textLength="74" lengthAdjust="spacingAndGlyphs"' : ''}>${esc(call)}</text>
<text x="50" y="${shape === 'pill' ? 70 : 82}" text-anchor="middle" font-family="'Oswald',sans-serif" font-weight="700" font-size="11" fill="${ink}" opacity=".85">${ch.n}</text></svg>`;
  cache.set(key, svg);
  return svg;
}
export const iconImg = (ch, cls = 'chicon') => `<span class="${cls}" aria-hidden="true">${iconSVG(ch)}</span>`;
