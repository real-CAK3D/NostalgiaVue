// The on-screen program guide (GUIDE button) and the shared grid renderer used by the Guide Channel.
import { $, esc, one, slotNow, fmtTime, SLOT } from './util.js';
import { settings, state } from './store.js';
import { CHANNELS, isHidden } from './lineup.js';
import { getList, listsDone, listKey } from './sources/archive.js';
import { iconSVG } from './icons.js';
import { lockup } from './logo.js';

const CAT_CLASS = {
  MOVIES: 'movie', HORROR: 'movie', 'SCI-FI': 'movie', WESTERN: 'movie', SPORTS: 'sport', NEWS: 'news', 'LOCAL TV': 'news',
  CARTOONS: 'kids', KIDS: 'kids', MUSIC: 'music', RADIO: 'music', PODCASTS: 'music', PPV: 'ppv', SHOPPING: 'ppv', YOUTUBE: 'yt',
};

function programTitle(ch, slot) {
  switch (ch.kind) {
    case 'yt': return ch.name;
    case 'local': return ch.map ? ch.map.label : 'Not set up';
    case 'games': return 'Game Channel — Press OK to play';
    case 'weather': return 'Local Forecast';
    case 'guidech': return 'NostalgiaVue Guide';
    case 'station': return ch.url ? `${ch.name} — Live on the web` : ch.open ? '— Open channel —' : ch.name;
    case 'external': return ch.ppv || ch.cat === 'PPV' ? `${ch.name} · PPV` : ch.name;
    case 'bars': return 'Test Pattern';
    case 'stream': return ch.name + ' (Live)';
  }
  if (ch.custom && !settings.custom) return '— Press ★ to program —';
  const l = listsDone.get(listKey(ch));
  if (l === undefined) return 'Loading…';
  if (l === null) return 'Off the Air';
  if (!l.length) return 'No Signal';
  const it = l[((slot % l.length) + l.length) % l.length];
  return one(it.title) || it.identifier;
}
const dim = t => /^(Loading|Off the Air|No Signal|—|Not set up)/.test(t);

// rows: CHANNELS slice with category headers. Used by both the guide and the guide channel.
export function guideGridHTML({ start = 0, count = CHANNELS.length, auto = false, sel = -1 } = {}) {
  const { slot, start: t0 } = slotNow(), h24 = settings.clock24;
  const list = CHANNELS.map((c, i) => [c, i]).filter(([c]) => !isHidden(c.n));
  const rows = auto ? Array.from({ length: Math.min(count, list.length) }, (_, k) => list[(start + k) % list.length]) : list;
  let lastCat = '', html = `<div class="g-row g-head"><div>${new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div>${[0, 1, 2].map(k => `<div>${fmtTime(t0 + k * SLOT, h24)}</div>`).join('')}</div><div class="g-rows">`;
  for (const [ch, i] of rows) {
    if (!auto && ch.cat !== lastCat) html += `<div class="g-cat">${esc(lastCat = ch.cat)}</div>`;
    const cls = CAT_CLASS[ch.cat] || '';
    const cells = [0, 1, 2].map(k => { const t = programTitle(ch, slot + k); return `<div class="g-cell ${cls}${k ? '' : ' now'}${dim(t) ? ' dim' : ''}">${esc(t)}</div>`; }).join('');
    html += `<div class="g-row${i === sel ? ' sel' : ''}${ch.n === state.num ? ' tuned' : ''}" data-i="${i}"><div class="g-cell g-ch"><span class="g-ico">${iconSVG(ch)}</span><em>${ch.n}</em><span class="g-call">${esc(ch.call)}</span></div>${cells}</div>`;
  }
  return html + '</div>';
}

let timer = 0, rafId = 0;
const soon = () => { if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; render(); }); };

function render() {
  if (!state.guide) return;
  const { slot, start } = slotNow(), h24 = settings.clock24;
  $('#gClock').textContent = new Date().toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: !h24 });
  const grid = $('#gGrid'), keep = grid.querySelector('.g-rows')?.scrollTop || 0;
  grid.innerHTML = guideGridHTML({ sel: state.guideSel });
  const rowsEl = grid.querySelector('.g-rows'); rowsEl.scrollTop = keep;
  const sel = CHANNELS[state.guideSel];
  if (sel) {
    const desc = sel.desc || (sel.kind === 'yt' ? 'Clips and full episodes from the official YouTube channel.' : sel.kind === 'archive' ? `${sel.cat.charAt(0) + sel.cat.slice(1).toLowerCase()} from the archive.org ${sel.audio ? 'audio' : 'film & TV'} vaults.` : '');
    $('#gDesc').innerHTML = `<div class="gd-head">${iconSVG(sel)}<div><b>${esc(programTitle(sel, slot))}</b><small>CH ${sel.n} · ${esc(sel.name)} · until ${fmtTime(start + SLOT, h24)}</small></div></div>${esc(desc)}<small>Next: ${esc(programTitle(sel, slot + 1))}</small>`;
  }
  rowsEl.querySelector(`[data-i="${state.guideSel}"]`)?.scrollIntoView({ block: 'nearest' });
  loadNear();
}
// Fetch schedules for the rows around the cursor first.
function loadNear() {
  const i0 = state.guideSel;
  CHANNELS.map((c, i) => [c, Math.abs(i - i0)]).filter(([c, d]) => d < 12 && c.kind === 'archive' && !isHidden(c.n))
    .forEach(([c]) => { if (listsDone.get(listKey(c)) === undefined) getList(c).then(soon, soon); });
}

export function openGuide() {
  if (!state.on) return;
  state.guide = true; $('#screen').classList.add('guide-open');
  $('#gLogo').innerHTML = lockup('white', 'gl');
  let i = CHANNELS.findIndex(c => c.n === state.num);
  state.guideSel = i < 0 ? 0 : i;
  ['#banner', '#info'].forEach(q => $(q).classList.remove('show'));
  render();
  clearInterval(timer); timer = setInterval(render, 20000);
}
export function closeGuide() { state.guide = false; $('#screen').classList.remove('guide-open'); clearInterval(timer); }
export function guideMove(d) {
  const n = CHANNELS.length; let i = state.guideSel;
  do { i = (i + d + n) % n; } while (isHidden(CHANNELS[i].n) && i !== state.guideSel);
  state.guideSel = i; render();
}
export function guidePage(d) { for (let k = 0; k < 6; k++) guideMove(d); }
export const guideSelected = () => CHANNELS[state.guideSel];
export function bindGuide(onPick) {
  $('#gGrid').addEventListener('click', e => { const r = e.target.closest('.g-row[data-i]'); if (r) onPick(CHANNELS[+r.dataset.i]); });
}
