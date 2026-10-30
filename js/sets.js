// The three NostalgiaVue sets and their remotes.
import { $ } from './util.js';
import { settings, state } from './store.js';
import { lockup, emblem, wordmark } from './logo.js';

export const SETS = {
  '80s': { model: 'Space Commander 25"', tag: 'SOLID STATE · CHROMACOLOR' },
  '90s': { model: 'TrinoTube KV-27', tag: 'TRINO-TUBE · STEREO' },
  '00s': { model: 'FlatFace Pro 32"', tag: 'PURE FLAT · DOLBY SURROUND' },
};

const btn = (act, label, cls = 'pbtn') => `<button type="button" class="${cls}" data-act="${act}">${label}</button>`;

function remoteHTML(set) {
  const d = n => `<button type="button" class="rb" data-d="${n}">${n}</button>`;
  return `
    <div class="r-ir" id="ir"></div>
    <div class="r-row"><button type="button" class="rb power" data-act="power" aria-label="Power">⏻</button>
      <button type="button" class="rpill" data-act="mute">MUTE</button><button type="button" class="rpill" data-act="zoom">ZOOM</button></div>
    <div class="r-grid">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d).join('')}
      <button type="button" class="rb small" data-act="last">LAST</button>${d(0)}<button type="button" class="rb small" data-act="ok">ENT</button></div>
    <div class="r-dpad">
      <button type="button" class="dp up" data-act="up" aria-label="Up">▲</button>
      <button type="button" class="dp left" data-act="left" aria-label="Left">◀</button>
      <button type="button" class="dp ok" data-act="ok">OK</button>
      <button type="button" class="dp right" data-act="right" aria-label="Right">▶</button>
      <button type="button" class="dp down" data-act="down" aria-label="Down">▼</button>
    </div>
    <div class="r-row">
      <div class="rocker"><button type="button" data-act="volup">+</button><label>VOL</label><button type="button" data-act="voldn">−</button></div>
      <div class="r-col"><button type="button" class="rpill" data-act="back">BACK</button><button type="button" class="rpill" data-act="info">INFO</button></div>
      <div class="rocker"><button type="button" data-act="chup">▲</button><label>CH</label><button type="button" data-act="chdn">▼</button></div>
    </div>
    <div class="r-row"><button type="button" class="rpill blue" data-act="guide">GUIDE</button><button type="button" class="rpill" data-act="menu">MENU</button></div>
    <div class="r-row"><button type="button" class="rpill red" data-act="ppv">PPV</button><button type="button" class="rpill green" data-act="games">GAME</button><button type="button" class="rpill yel" data-act="find">★ FIND</button></div>
    <div class="r-brand">${set === '00s' ? wordmark('dark', 'rw') : lockup(set === '80s' ? 'white' : 'chrome', 'rl')}</div>
    <div class="r-model">${set === '80s' ? 'SPACE COMMAND' : set === '00s' ? 'UNIVERSAL RC-2000' : 'REMOTE COMMANDER'}</div>`;
}

export function renderSet() {
  const set = settings.set, info = SETS[set];
  document.body.dataset.set = set;
  $('#set').className = 'set set-' + set + (state.on ? ' on' : '');
  $('#remote').className = 'remote remote-' + set;
  $('#remote').innerHTML = remoteHTML(set);
  if (set === '80s') {
    $('#decoTop').innerHTML = '<div class="ears"><i class="ear l"></i><i class="ear r"></i><b></b></div>';
    $('#side').innerHTML = `
      <div class="badge80">${lockup('white', 's80')}</div>
      <div class="knob-wrap"><div class="knob dial" id="dial" data-act="chup" title="Channel">${Array.from({ length: 12 }, (_, i) => `<span style="--a:${i * 30}deg">${i + 2}</span>`).join('')}<i></i></div><small>VHF</small></div>
      <div class="knob-wrap"><div class="knob small" id="volKnob" data-act="volup" title="Volume"><i></i></div><small>VOLUME</small></div>
      <div class="side-btns">${btn('power', 'PULL ON', 'pbtn pull')}<span class="led"></span></div>
      <div class="side-model">${info.model}<br><small>${info.tag}</small></div>`;
    $('#panel').innerHTML = '<div class="fabric"></div>';
    $('#stand').innerHTML = '<i class="leg"></i><i class="leg"></i><i class="leg"></i><i class="leg"></i>';
  } else if (set === '00s') {
    $('#decoTop').innerHTML = '';
    $('#side').innerHTML = '';
    $('#panel').innerHTML = `<div class="spk"></div><div class="mid00"><span class="led"></span><span class="brand00">${wordmark('dark', 'p00')}</span><span class="model00">${info.model} · ${info.tag}</span></div>
      <div class="btns00">${btn('menu', 'MENU')}${btn('chdn', 'CH−')}${btn('chup', 'CH+')}${btn('voldn', 'VOL−')}${btn('volup', 'VOL+')}${btn('power', '⏻')}</div><div class="spk"></div>`;
    $('#stand').innerHTML = '<i class="neck"></i><i class="foot"></i>';
  } else {
    $('#decoTop').innerHTML = '';
    $('#side').innerHTML = '';
    $('#panel').innerHTML = `<div class="brand90">${lockup('chrome', 'p90')}<small>${info.model} · ${info.tag}</small></div><div class="grille"></div>
      <div class="btns">${btn('power', 'POWER')}<span class="led"></span>${btn('chdn', 'CH ▼')}${btn('chup', 'CH ▲')}${btn('voldn', 'VOL −')}${btn('volup', 'VOL +')}${btn('menu', 'MENU')}${btn('guide', 'GUIDE')}</div>`;
    $('#stand').innerHTML = '';
  }
  turnDial();
}

// The 80s VHF dial physically turns to the channel (it clunks past 13 into "UHF").
export function turnDial() {
  const d = $('#dial'); if (!d) return;
  const n = state.num, a = n >= 2 && n <= 13 ? (n - 2) * 30 : 330 + (n % 7) * 2;
  d.style.setProperty('--turn', `${-a}deg`);
  const vk = $('#volKnob'); if (vk) vk.style.setProperty('--turn', `${settings.vol * 270 - 135}deg`);
}
export function irBlink() { const ir = $('#ir'); if (!ir) return; ir.classList.add('blink'); setTimeout(() => ir.classList.remove('blink'), 120); }
export { emblem };
