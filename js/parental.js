// Parental controls: a 4-digit PIN that locks chosen categories/channels, and a Kids profile that
// only shows kid-friendly channels. Nothing is locked until a PIN is set.
import { esc } from './util.js';
import { settings, save, state } from './store.js';
import { scene, staticOff, msg } from './osd.js';
import { iconSVG } from './icons.js';
import { kidsHidden } from './lineup.js';
export { kidsHidden };

const unlocked = new Set();                  // channels unlocked with the PIN until the set is turned off
export const clearUnlocks = () => unlocked.clear();

export const pinSet = () => /^\d{4}$/.test(settings.pin || '');
export function isLocked(ch) {
  if (!pinSet() || unlocked.has(ch.n)) return false;
  return (settings.lockedCats || []).includes(ch.cat) || (settings.lockedChannels || []).includes(ch.n);
}

// PIN entry on the lock screen, typed with the remote's number buttons.
let entry = '', pending = null;
export const pinEntryActive = () => !!pending;
export function showLock(ch, onUnlock) {
  pending = { ch, onUnlock }; entry = '';
  staticOff();
  render();
}
function render(bad) {
  const ch = pending.ch;
  scene(`<div class="card lock"><div class="card-icon">${iconSVG(ch)}</div><div class="card-name">🔒 ${esc(ch.name)}</div>
    <div class="card-text">${settings.kids && kidsHidden(ch) ? 'Kids profile is on — this one isn’t for kids.' : 'This channel is locked.'} ${pinSet() ? 'Enter the PIN with the number buttons.' : 'Turn off the Kids profile in MENU › Parental.'}</div>
    ${pinSet() ? `<div class="pin">${[0, 1, 2, 3].map(i => `<i class="${i < entry.length ? 'on' : ''}"></i>`).join('')}</div>` : ''}
    ${bad ? '<div class="card-text bad">Wrong PIN</div>' : ''}</div>`, 'cardscene');
}
export function pinDigit(d) {
  if (!pending || !pinSet()) return false; // no PIN to type: number buttons just change the channel
  entry += d;
  if (entry.length < 4) { render(); return true; }
  if (entry === settings.pin) {
    const p = pending; pending = null; entry = '';
    unlocked.add(p.ch.n); p.onUnlock();
  } else { entry = ''; render(true); }
  return true;
}
export function cancelPin() { pending = null; entry = ''; }
// Asks for the PIN before changing a parental setting (only once a PIN exists).
export function confirmPin(reason) {
  if (!pinSet()) return true;
  const got = prompt(`${reason}\nEnter the 4-digit PIN:`);
  if (got === settings.pin) return true;
  if (got != null) alert('Wrong PIN.');
  return false;
}
export function setPin(newPin) {
  if (!/^\d{4}$/.test(newPin)) return 'The PIN must be 4 digits.';
  if (!confirmPin('Change the PIN')) return 'PIN not changed.';
  settings.pin = newPin; save(); return 'PIN saved. Locked channels now need it.';
}
export { msg };
