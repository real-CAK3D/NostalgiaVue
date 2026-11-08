// The service password: it opens service mode (service.js) and unlocks the adult channels for
// watching, once per power-on. It's checked in the browser against a hash, which keeps people out
// casually but isn't a vault.
import { state } from './store.js';
import { esc } from './util.js';
import { scene, staticOff } from './osd.js';

const HASH = 'db74c33d9b26cfd8be91c9f26bda3a827d7dff89ef7d71ca336414bdeefc2555';
let unlocked = false;
export const adultUnlocked = () => unlocked;
export const lockAdultAgain = () => { unlocked = false; };
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('nostalgiavue-xxx:' + s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export const verifyPassword = async pw => (await sha(pw || '')) === HASH;
async function unlock(pw) { const ok = await verifyPassword(pw); if (ok) unlocked = true; return ok; }

// the lock card on an adult channel: the password, then `then()`
export function askPassword(ch, token, bad, then) {
  staticOff();
  scene(`<div class="card lock"><div class="card-name">🔞 ${esc(ch.name)}</div>
    <div class="card-text">Adults only. Enter the password.</div>
    <form class="pw-form"><input type="password" autocomplete="off" placeholder="password"><button type="submit" class="card-go">Unlock</button></form>
    ${bad ? '<div class="card-text bad">Wrong password</div>' : ''}</div>`, 'cardscene');
  const form = document.querySelector('.pw-form'), input = form.querySelector('input');
  input.focus();
  form.onsubmit = async e => {
    e.preventDefault();
    if (await unlock(input.value)) { if (token === state.token) then(); }
    else if (token === state.token) askPassword(ch, token, true, then);
  };
}
