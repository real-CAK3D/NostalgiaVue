// Service mode: the hidden menu a TV repair tech knows the code for. A secret sequence on the remote
// lights the remote's LED green and asks for the service password; then the SERVICE tab opens.
// Nothing about it shows anywhere until then.
import { state } from './store.js';
import { hash } from './util.js';
import { scene, staticOff } from './osd.js';
import { verifyPassword } from './adultlock.js';

// The sequence: MENU twice, GUIDE twice, then OK (closing the menu or guide in between doesn't
// count, so it works the same with a phone's full-screen pages). Then the TV asks for the service
// PIN, then the service password. Only a fingerprint of the PIN is kept here.
const SEQ = ['menu', 'menu', 'guide', 'guide', 'ok'];
const PIN = 1119970472;
let pos = 0, last = 0;
const hooks = () => state.hooks;

export const serviceActive = () => !!state.service;
const led = on => document.getElementById('ir')?.classList.toggle('service', on);

// Fed every remote press (buttons as their action name, digits as '0'-'9'). Returns true when the
// press was part of the sequence and shouldn't do its normal job.
export function serviceKey(k) {
  const now = Date.now();
  if (now - last > 10000) pos = 0;
  last = now;
  if (k === 'back') return false;                   // closing the menu / guide (✕) in between
  if (k === SEQ[pos]) {
    if (++pos === SEQ.length) { pos = 0; enter(); return true; }
    return false;
  }
  pos = k === SEQ[0] ? 1 : 0;
  return false;
}

function enter() {
  hooks().closeMenu?.(); hooks().closeGuide?.();
  led(true); staticOff();
  askPin();
}
// one card for both steps: the PIN, then the password; two wrong tries and the set goes back to normal
function card(title, hint, numeric, bad, check, next) {
  scene(`<div class="card lock service"><div class="card-name">SERVICE MODE</div>
    <div class="card-text">${title}</div>
    <form class="pw-form"><input type="password" autocomplete="off" ${numeric ? 'inputmode="numeric" maxlength="8"' : ''} placeholder="${hint}"><button type="submit" class="card-go">OK</button></form>
    ${bad ? '<div class="card-text bad">Wrong — try again</div>' : ''}</div>`, 'cardscene');
  const form = document.querySelector('.pw-form'), input = form.querySelector('input');
  input.focus();
  input.addEventListener('keydown', e => { if (e.key === 'Escape') leave(); });
  form.onsubmit = async e => {
    e.preventDefault();
    if (await check(input.value.trim())) next();
    else if (bad) leave();
    else card(title, hint, numeric, true, check, next);
  };
}
const askPin = () => card('Enter the service PIN.', 'PIN', true, false, async v => /^\d+$/.test(v) && hash('nv-service', v) === PIN, askPassword);
const askPassword = () => card('Service password.', 'password', false, false, verifyPassword, () => { state.service = true; scene(''); hooks().openMenu?.('service'); });
export function leave() {
  state.service = false; led(false);
  if (document.querySelector('.card.service')) { scene(''); hooks().retune?.(); }
}
