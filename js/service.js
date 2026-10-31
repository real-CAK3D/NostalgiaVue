// Service mode: the hidden menu a TV repair tech knows the code for. A secret sequence on the remote
// lights the remote's LED green and asks for the service password; then the SERVICE tab opens.
// Nothing about it shows anywhere until then.
import { state } from './store.js';
import { hash } from './util.js';
import { scene, staticOff } from './osd.js';
import { verifyPassword } from './xxx.js';

// MENU and GUIDE presses arm it; then a code on the number buttons and OK. Only a fingerprint of the
// code is kept here, so reading this file doesn't give it away.
const ARM = ['menu', 'menu', 'menu', 'menu', 'menu', 'guide', 'guide', 'guide', 'guide', 'guide'];
const CODE = 1119970472;
let pos = 0, last = 0, code = null;
const hooks = () => state.hooks;

export const serviceActive = () => !!state.service;
const led = on => document.getElementById('ir')?.classList.toggle('service', on);

// Fed every remote press (buttons as their action name, digits as '0'-'9'). Returns true when the
// press was part of the code and shouldn't do its normal job.
export function serviceKey(k) {
  const now = Date.now();
  if (now - last > 5000) { pos = 0; code = null; }
  last = now;
  if (code != null) {                               // armed: digits are the code, OK checks it
    if (/^\d$/.test(k) && code.length < 8) { code += k; return true; }
    const tried = code; code = null; pos = 0;
    if (k === 'ok' && hash('nv-service', tried) === CODE) { enter(); return true; }
    return k === 'ok';
  }
  if (k === ARM[pos]) { if (++pos === ARM.length) { pos = 0; code = ''; } return false; }
  pos = k === ARM[0] ? 1 : 0;
  return false;
}

function enter() {
  hooks().closeMenu?.(); hooks().closeGuide?.();
  led(true); staticOff();
  ask();
}
function ask(bad) {
  scene(`<div class="card lock service"><div class="card-name">SERVICE MODE</div>
    <div class="card-text">Enter the service password.</div>
    <form class="xxx-pw"><input type="password" autocomplete="off"><button type="submit" class="card-go">OK</button></form>
    ${bad ? '<div class="card-text bad">Wrong password</div>' : ''}</div>`, 'cardscene');
  const form = document.querySelector('.xxx-pw'), input = form.querySelector('input');
  input.focus();
  input.addEventListener('keydown', e => { if (e.key === 'Escape') leave(); });
  form.onsubmit = async e => {
    e.preventDefault();
    if (await verifyPassword(input.value)) { state.service = true; scene(''); hooks().openMenu?.('service'); }
    else if (bad) leave();            // two strikes and the set goes back to normal
    else ask(true);
  };
}
export function leave() {
  state.service = false; led(false);
  if (document.querySelector('.card.service')) { scene(''); hooks().retune?.(); }
}
