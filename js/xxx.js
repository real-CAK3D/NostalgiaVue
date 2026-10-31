// The XXX channel (599): hardcore videos from adult sites, for adults only.
// - Hidden from the dial and the guide until it's turned on in MENU › Parental with its own password.
// - Asks for that password again every time the set is turned on.
// - Plays the video links you add (on this device only) through each site's embeddable player,
//   a new one every half hour (OK = next). With no links yet it shows the sites to pick from.
// - Never counted in the shared stats.
// The password is checked in the browser against a hash, which keeps people out casually but isn't
// a vault: anyone with the device and the know-how could get past it.
import { settings, state } from './store.js';
import { esc, hash, daySeed, slotNow } from './util.js';
import { scene, staticOff, hideMsg, msg, staticOn } from './osd.js';
import { inApp } from './sources/special.js';

const HASH = 'db74c33d9b26cfd8be91c9f26bda3a827d7dff89ef7d71ca336414bdeefc2555';
let unlocked = false, idx = null;
// one unlock covers the adult channels and XXX until the set is turned off
export const xxxUnlocked = () => unlocked;
export const xxxLockAgain = () => { unlocked = false; idx = null; };
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('nostalgiavue-xxx:' + s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
// the service password: opens service mode, and unlocks adult channels for watching
export const verifyPassword = async pw => (await sha(pw || '')) === HASH;
export async function checkXxx(pw) { const ok = await verifyPassword(pw); if (ok) unlocked = true; return ok; }

export const SITES = [
  ['Pornhub', 'https://www.pornhub.com/'], ['xHamster', 'https://xhamster.com/'], ['XVideos', 'https://www.xvideos.com/'],
  ['YouPorn', 'https://www.youporn.com/'], ['RedTube', 'https://www.redtube.com/'], ['SpankBang', 'https://spankbang.com/'],
  ['Eporner', 'https://www.eporner.com/'],
];

// a video page link -> that site's embeddable player (sites block their normal pages inside other sites)
export function embedUrl(u) {
  try {
    const x = new URL(String(u).trim()), h = x.hostname.replace(/^(www|[a-z]{2})\./, ''), p = x.pathname;
    let m;
    if (h === 'pornhub.com') { const k = x.searchParams.get('viewkey') || (p.match(/\/embed\/([^/?]+)/) || [])[1]; if (k) return `https://www.pornhub.com/embed/${k}`; }
    if (h === 'xvideos.com' && (m = p.match(/^\/video\.?([a-z0-9]+)/i))) return `https://www.xvideos.com/embedframe/${m[1]}`;
    if (h === 'xhamster.com' && (m = p.match(/\/videos\/(?:.*-)?([a-z0-9]+)\/?$/i))) return `https://xhamster.com/xembed.php?video=${m[1]}`;
    if (h === 'youporn.com' && (m = p.match(/\/(?:watch|embed)\/(\d+)/))) return `https://www.youporn.com/embed/${m[1]}`;
    if (h === 'redtube.com' && (m = p.match(/^\/(\d+)/))) return `https://embed.redtube.com/?id=${m[1]}`;
    if (h === 'spankbang.com' && (m = p.match(/^\/([a-z0-9]+)\/(?:video|embed)/i))) return `https://spankbang.com/${m[1]}/embed/`;
    if (h === 'eporner.com' && (m = p.match(/(?:video-|embed\/)([a-z0-9]+)/i))) return `https://www.eporner.com/embed/${m[1]}/`;
    return /^https?:$/.test(x.protocol) ? x.href : null;
  } catch { return null; }
}
export const xxxLinks = () => (settings.xxxLinks || []).map(embedUrl).filter(Boolean);

function frame(url, note) {
  const f = document.querySelector('#webFrame'), hint = document.querySelector('#webHint');
  staticOff(); hideMsg(); scene('');
  f.src = url; f.hidden = false;
  hint.innerHTML = `<span>${esc(note)}</span>`; hint.hidden = false;
  setTimeout(() => { hint.hidden = true; }, 6000);
}

export function askPassword(ch, token, bad, then) {
  staticOff();
  scene(`<div class="card lock"><div class="card-name">🔞 ${esc(ch.name)}</div>
    <div class="card-text">Adults only. Enter the password.</div>
    <form class="xxx-pw"><input type="password" autocomplete="off" placeholder="password"><button type="submit" class="card-go">Unlock</button></form>
    ${bad ? '<div class="card-text bad">Wrong password</div>' : ''}</div>`, 'cardscene');
  const form = document.querySelector('.xxx-pw'), input = form.querySelector('input');
  input.focus();
  form.onsubmit = async e => {
    e.preventDefault();
    if (await checkXxx(input.value)) { if (token === state.token) then(); }
    else if (token === state.token) askPassword(ch, token, true, then);
  };
}

export function xxxSites(ch) {
  staticOff(); hideMsg();
  scene(`<div class="card ppv"><div class="ppv-head">XXX · ADULTS ONLY</div><div class="card-name">${esc(ch.name)}</div>
    <div class="card-text">${xxxLinks().length ? 'Pick a site, or press OK to go back to your videos.' : 'No videos added yet. Copy video links from these sites into MENU › Parental › XXX channel and they’ll play here, a new one every half hour.'}</div>
    <div class="card-btns xxx-sites">${SITES.map(([n, u]) => `<button type="button" class="card-go alt" data-u="${esc(u)}">${esc(n)}</button>`).join('')}</div>
    <div class="ppv-fine">${inApp ? 'Sites open inside the set.' : 'Sites open in a new tab (they don’t allow being shown inside other sites; the Windows app can show them in the set).'}</div></div>`, 'cardscene');
  document.querySelectorAll('.xxx-sites [data-u]').forEach(b => b.onclick = () => inApp ? frame(b.dataset.u, `XXX · ${b.textContent} · BACK = sites`) : window.open(b.dataset.u, '_blank', 'noopener'));
}

export function tuneXxx(ch, token, { next } = {}) {
  if (!settings.xxxOn) { staticOn(); msg(`CHANNEL ${ch.n}`, 'No signal'); return; }
  if (!unlocked) return askPassword(ch, token, false, () => tuneXxx(ch, token));
  const links = xxxLinks();
  if (!links.length) return xxxSites(ch);
  if (idx == null) idx = hash(daySeed(), slotNow().slot) % links.length;
  else if (next) idx = (idx + 1) % links.length;
  frame(links[idx % links.length], `XXX · video ${idx % links.length + 1} of ${links.length} · OK = next · BACK = sites`);
}
