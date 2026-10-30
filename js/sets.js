// The NostalgiaVue lineup of sets (three per decade) and their remotes.
import { $, pad } from './util.js';
import { settings, state } from './store.js';
import { lockup, wordmark } from './logo.js';

export const SETS = {
  '80s-console':  { era: '80s', model: 'Space Commander 25"', tag: 'SOLID STATE · CHROMACOLOR', skin: 'console', year: 1981 },
  '80s-portable': { era: '80s', model: 'Portavision 13"', tag: 'AC/DC · INSTANT ON', skin: 'portable', year: 1984 },
  '80s-monitor':  { era: '80s', model: 'Monitor/Receiver 27"', tag: 'CABLE READY · MTS STEREO', skin: 'monitor80', year: 1988 },
  '90s-trino':    { era: '90s', model: 'TrinoTube KV-27', tag: 'TRINO-TUBE · STEREO', skin: 'trino', year: 1993 },
  '90s-combo':    { era: '90s', model: 'VCR Combo 13"', tag: 'TV/VCR · 4-HEAD HI-FI', skin: 'combo', year: 1996 },
  '90s-big':      { era: '90s', model: 'BigVue 32" Surround', tag: 'DOLBY SURROUND · COMB FILTER', skin: 'big90', year: 1998 },
  '00s-flat':     { era: '00s', model: 'FlatFace Pro 32"', tag: 'PURE FLAT · DOLBY SURROUND', skin: 'flat', year: 2002 },
  '00s-wide':     { era: '00s', model: 'WideTube 30" HD', tag: '16:9 HD-READY CRT · 1080i', skin: 'wide', year: 2005, aspect: '16/9' },
  '00s-plasma':   { era: '00s', model: 'PlasmaVue 42"', tag: 'PLASMA HDTV · 720p', skin: 'plasma', year: 2008, aspect: '16/9' },
};
const LEGACY = { '80s': '80s-console', '90s': '90s-trino', '00s': '00s-flat' };
export const setId = () => SETS[settings.set] ? settings.set : (LEGACY[settings.set] || '90s-trino');
export const era = () => SETS[setId()].era;

const btn = (act, label, cls = 'pbtn') => `<button type="button" class="${cls}" data-act="${act}">${label}</button>`;

function remoteHTML(e) {
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
    <div class="r-brand">${e === '00s' ? wordmark('dark', 'rw') : lockup(e === '80s' ? 'white' : 'chrome', 'rl')}</div>
    <div class="r-model">${e === '80s' ? 'SPACE COMMAND' : e === '00s' ? 'UNIVERSAL RC-2000' : 'REMOTE COMMANDER'}</div>`;
}

const dial = () => `<div class="knob-wrap"><div class="knob dial" id="dial" data-act="chup" title="Channel (click)">${Array.from({ length: 12 }, (_, i) => `<span style="--a:${i * 30}deg">${i + 2}</span>`).join('')}<i></i></div><small>VHF</small></div>`;
const uhf = () => `<div class="knob-wrap"><div class="knob small uhf" data-act="chdn" title="Channel down"><i></i></div><small>UHF</small></div>`;
const volKnob = () => `<div class="knob-wrap"><div class="knob small" id="volKnob" data-act="volup" title="Volume"><i></i></div><small>VOLUME</small></div>`;

function parts(id, s) {
  const p = { top: '', side: '', panel: '', stand: '' };
  switch (s.skin) {
    case 'console':
      p.top = '<div class="ears"><i class="ear l"></i><i class="ear r"></i><b></b></div>';
      p.side = `<div class="badge80">${lockup('white', 's80')}</div>${dial()}${volKnob()}<div class="side-btns">${btn('power', 'PULL ON', 'pbtn pull')}<span class="led"></span></div><div class="side-model">${s.model}<br><small>${s.tag}</small></div>`;
      p.panel = '<div class="fabric"></div>';
      p.stand = '<i class="leg"></i><i class="leg"></i><i class="leg"></i><i class="leg"></i>';
      break;
    case 'portable':
      p.top = '<div class="handle"></div><div class="whip"></div>';
      p.side = `<div class="badge80">${lockup('white', 'sp8')}</div>${dial()}${uhf()}${volKnob()}<div class="side-btns">${btn('power', 'ON/OFF', 'pbtn pull')}<span class="led"></span></div><div class="porthole"></div><div class="side-model">${s.model}<br><small>${s.tag}</small></div>`;
      p.stand = '<i class="foot"></i><i class="foot"></i>';
      break;
    case 'monitor80':
      p.panel = `<div class="spk80"></div><div class="mon-mid"><span class="brand80">${lockup('chrome', 'm80')}</span><span class="led7" id="led7">--</span>
        <div class="touch">${btn('power', 'POWER')}${btn('chdn', 'CH ▼')}${btn('chup', 'CH ▲')}${btn('voldn', 'VOL ▼')}${btn('volup', 'VOL ▲')}${btn('menu', 'TV/CATV')}</div>
        <span class="tag80">${s.model} · ${s.tag}</span></div><div class="spk80"></div>`;
      break;
    case 'combo':
      p.panel = `<div class="combo-left"><span class="brand90">${lockup('chrome', 'c90')}</span><small>${s.model} · ${s.tag}</small></div>
        <div class="vcr"><div class="slot"><i></i></div><div class="vfd" id="vfd">12:00</div>
        <div class="transport">${btn('back', '⏏')}${btn('left', '◀◀')}${btn('ok', '▶')}${btn('info', '■')}${btn('right', '▶▶')}${btn('mute', '●')}</div></div>
        <div class="btns">${btn('power', 'POWER')}<span class="led"></span>${btn('chdn', 'CH▼')}${btn('chup', 'CH▲')}</div>`;
      break;
    case 'big90':
      p.side = '<div class="spk-tall"></div>';
      p.panel = `<div class="brand90">${lockup('chrome', 'b90')}<small>${s.model}</small></div><span class="gold">${s.tag}</span>
        <div class="btns">${btn('power', 'POWER')}<span class="led"></span>${btn('chdn', 'CH ▼')}${btn('chup', 'CH ▲')}${btn('voldn', 'VOL −')}${btn('volup', 'VOL +')}${btn('menu', 'MENU')}</div>`;
      break;
    case 'flat':
      p.panel = `<div class="spk"></div><div class="mid00"><span class="led"></span><span class="brand00">${wordmark('dark', 'p00')}</span><span class="model00">${s.model} · ${s.tag}</span></div>
        <div class="btns00">${btn('menu', 'MENU')}${btn('chdn', 'CH−')}${btn('chup', 'CH+')}${btn('voldn', 'VOL−')}${btn('volup', 'VOL+')}${btn('power', '⏻')}</div><div class="spk"></div>`;
      p.stand = '<i class="neck"></i><i class="foot"></i>';
      break;
    case 'wide':
      p.panel = `<div class="spk dark"></div><div class="mid00"><span class="brand00">${wordmark('chrome', 'pw0')}</span><span class="model00 light">${s.model} · ${s.tag}</span></div>
        <div class="btns00 dark">${btn('menu', 'MENU')}${btn('chdn', 'CH−')}${btn('chup', 'CH+')}${btn('voldn', 'VOL−')}${btn('volup', 'VOL+')}${btn('power', '⏻')}</div><span class="led"></span><div class="spk dark"></div>`;
      break;
    case 'plasma':
      p.panel = `<div class="plasma-bar"><span class="brand00">${wordmark('chrome', 'pp0')}</span><span class="led"></span><span class="model00 light">${s.model} · ${s.tag}</span></div>`;
      p.stand = '<i class="neck"></i><i class="foot"></i>';
      break;
  }
  return p;
}

export function renderSet() {
  const id = setId(), s = SETS[id], p = parts(id, s);
  document.body.dataset.set = s.era;
  $('#set').className = `set set-${s.era} skin-${s.skin}${state.on ? ' on' : ''}`;
  $('#screen').style.setProperty('--aspect', s.aspect || '4/3');
  $('#screen').classList.toggle('wide', !!s.aspect);
  $('#remote').className = 'remote remote-' + s.era;
  $('#remote').innerHTML = remoteHTML(s.era);
  $('#decoTop').innerHTML = p.top; $('#side').innerHTML = p.side; $('#panel').innerHTML = p.panel; $('#stand').innerHTML = p.stand;
  turnDial();
}

// The 80s VHF dial physically turns to the channel; the 80s/90s sets also have channel readouts.
export function turnDial() {
  const n = state.num, d = $('#dial');
  if (d) d.style.setProperty('--turn', `${-(n >= 2 && n <= 13 ? (n - 2) * 30 : 330 + (n % 7) * 2)}deg`);
  const vk = $('#volKnob'); if (vk) vk.style.setProperty('--turn', `${settings.vol * 270 - 135}deg`);
  const led = $('#led7'); if (led) led.textContent = state.on ? String(n).padStart(3, ' ').slice(-3) : '';
  const vfd = $('#vfd');
  if (vfd) vfd.textContent = state.on ? `CH${pad(n % 1000)}` : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
setInterval(() => { if (!state.on) turnDial(); }, 30000);
export function irBlink() { const ir = $('#ir'); if (!ir) return; ir.classList.add('blink'); setTimeout(() => ir.classList.remove('blink'), 120); }
