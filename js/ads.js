// Commercial breaks: every N minutes of program, freeze the show, roll vintage spots, come back.
import { $, sleep } from './util.js';
import { settings, state } from './store.js';
import { suspendProgram, setBreakHook, playUrl, stopVideo, v } from './player.js';
import { getList, resolveItem } from './sources/archive.js';
import { ADS_QUERY } from './lineup.js';
import { scene, clearScene, staticOff, hide } from './osd.js';
import { sting } from './sound.js';
import { lockup } from './logo.js';

const ADS_CH = { n: 90174, call: 'ADS', name: 'ads', q: ADS_QUERY };

function bumper(text, sub) {
  v.hidden = true;
  scene(`<div class="bumper"><div class="bp-logo">${lockup('color', 'bp' + Date.now())}</div><div class="bp-text">${text}</div>${sub ? `<div class="bp-sub">${sub}</div>` : ''}</div>`, 'bumperscene');
}

function playSpot(p, token) {
  return new Promise(res => {
    const f = p.groups[0][Math.floor(Math.random() * p.groups[0].length)];
    let done = false; const fin = () => { if (!done) { done = true; res(); } };
    clearScene(); v.hidden = false;
    playUrl({ url: f.url, seekRandom: true, clipLen: 25 + Math.random() * 35, timeout: 12000, onEnded: fin, onError: fin, onBlocked: fin, onPlaying: staticOff });
    // hard stop in case the clip timer never fires
    setTimeout(fin, 75000);
    const iv = setInterval(() => { if (token !== state.token) { clearInterval(iv); fin(); } }, 300);
  });
}

export async function runBreak(force = false) {
  if (state.inBreak || (!settings.ads && !force)) return;
  const resume = suspendProgram(); if (!resume) return;
  const token = state.token;
  state.inBreak = true;
  ['#banner', '#info'].forEach(q => hide($(q)));
  try {
    bumper('WE’LL BE RIGHT BACK', 'Stay tuned to NostalgiaVue'); sting();
    const [list] = await Promise.all([getList(ADS_CH).catch(() => []), sleep(2600)]);
    if (token !== state.token) return;
    for (let k = 0, tries = 0; k < settings.adCount && tries < settings.adCount * 3 && list.length; tries++) {
      const item = list[Math.floor(Math.random() * list.length)];
      let p = null; try { p = await resolveItem(item); } catch {}
      if (token !== state.token) return;
      if (!p || p.kind !== 'video') continue;
      await playSpot(p, token); k++;
      if (token !== state.token) return;
    }
    stopVideo();
    bumper('AND NOW, BACK TO OUR PROGRAM'); sting();
    await sleep(1800);
    if (token !== state.token) return;
    clearScene(); v.hidden = false;
    resume();
  } finally { state.inBreak = false; }
}
setBreakHook(() => runBreak());
