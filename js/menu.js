// On-screen TV settings (MENU button).
import { $, $$, esc } from './util.js';
import { settings, save, state, exportSettings, importSettings, resetAll, eraLabel } from './store.js';
import { SECTIONS, CHANNELS, buildLineup, chanByNum, nextFree, makeCall, sectionOf } from './lineup.js';
import { iconSVG } from './icons.js';
import { SETS, setId, era } from './sets.js';
import { resolvePlace } from './sources/special.js';
import { bridgeApi, jellyfinLibraries, parseM3U } from './sources/local.js';
import { parseYouTube, resolveHandle, testYouTube, explainYtError, ytCaptions } from './sources/youtube.js';
import { applySubs } from './player.js';
import { myStats, sharedSummary, starsHTML, fmtMins, resetMyStats } from './stats.js';
import { lockup } from './logo.js';
import { GUIDE_STYLES } from './guide.js';
import { pinSet, setPin, confirmPin, ADULT_CATS } from './parental.js';

const TABS = [['picture', 'Picture'], ['sound', 'Sound'], ['ads', 'Commercials'], ['location', 'Location'], ['sources', 'Sources'], ['channels', 'Channels'], ['parental', 'Parental'], ['stats', 'Stats'], ['system', 'System']];
let tab = 'picture', libs = [], folders = [], installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
// Add to Home Screen: Chrome/Edge/Android get the real install prompt; iPhone and others get the steps
export const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const canPrompt = () => !!installEvt;
export function installHelp() {
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'Tap the Share button (□↑) in the address bar › Add to Home Screen.' : 'In Safari, tap Share (□↑) at the bottom › scroll down › Add to Home Screen › Add.';
  if (/Android/.test(ua)) return /SamsungBrowser/.test(ua) ? 'Tap the ≡ menu › Add page to › Home screen.' : /Firefox/.test(ua) ? 'Tap ⋮ › Install (or Add to Home screen).' : 'Tap ⋮ (top right) › Add to Home screen › Install.';
  return 'In Chrome or Edge, click the install icon (⊕) at the right end of the address bar, or ⋮ › Cast, save and share › Install page as app.';
}

const hooks = () => state.hooks;
const changed = (rebuild) => { save(); if (rebuild) { buildLineup(); hooks().lineupChanged?.(); } hooks().apply?.(); };

const range = (k, label, min = 0, max = 100, step = 1) => `<label class="m-row"><span>${label}</span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${settings[k]}"><output>${settings[k]}</output></label>`;
const check = (k, label) => `<label class="m-row m-check"><span>${label}</span><input type="checkbox" data-k="${k}" ${settings[k] ? 'checked' : ''}><i></i></label>`;
const select = (k, label, opts) => `<label class="m-row"><span>${label}</span><select data-k="${k}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(settings[k]) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
const text = (k, label, ph = '', type = 'text') => `<label class="m-row"><span>${label}</span><input type="${type}" data-k="${k}" value="${esc(settings[k] || '')}" placeholder="${esc(ph)}" autocomplete="off" spellcheck="false">${type === 'password' ? `<button type="button" class="m-eye" data-eye="${k}" aria-label="Show or hide" title="Show / hide">👁</button>` : ''}</label>`;

function body() {
  switch (tab) {
    case 'picture': return `
      <label class="m-row"><span>TV set</span><select data-k="set">${Object.entries(SETS).map(([k, s]) => `<option value="${k}" ${k === setId() ? 'selected' : ''}>${s.year} · NostalgiaVue ${esc(s.model)}</option>`).join('')}</select></label>
      ${check('remote', 'Show remote')}${check('zoom', 'Screen only (zoom)')}
      ${range('scanlines', 'Scanlines')}${range('mask', 'Phosphor mask')}${range('curvature', 'Glass & curve')}
      ${range('color', 'Color', 0, 160)}${range('brightness', 'Brightness', 50, 150)}
      ${select('guideStyle', 'Guide style', GUIDE_STYLES)}
      ${select('changeFx', 'Channel change', [['era', 'Like the era (snow & roll / blue / black)'], ['snow', 'Snow'], ['roll', 'Snow + vertical roll'], ['blue', 'Blue screen'], ['black', 'Black']])}
      ${check('humBar', 'Rolling hum bar')}${check('glow', 'Wall glow & night room')}
      ${check('reception', 'Rabbit-ear reception (80s sets: drag the antenna)')}${check('signOff', 'Overnight sign-off (3–5 AM on classic cable)')}${check('warp', 'Curved glass (experimental)')}
      ${check('logoIntro', 'NostalgiaVue logo at power-on')}${check('clock24', '24-hour clock')}
      <div class="m-row"><span>Full screen</span><button type="button" class="m-btn" data-do="fullscreen">Go full screen</button></div>`;
    case 'sound': return `
      ${range('vol', 'Volume', 0, 1, .05)}${range('noise', 'Static loudness')}
      ${check('clicks', 'Remote & button sounds')}${check('whine', 'CRT whine (15.7 kHz)')}`;
    case 'ads': return `
      <p class="m-note">Real TV had breaks. Vintage commercials from archive.org roll every few minutes of program on archive, local and stream channels. YouTube runs its own ads.</p>
      ${check('ads', 'Commercial breaks')}
      ${select('adEvery', 'Break every', [[10, '10 minutes'], [15, '15 minutes'], [20, '20 minutes'], [30, '30 minutes']])}
      ${select('adCount', 'Spots per break', [[1, '1'], [2, '2'], [3, '3'], [4, '4']])}
      <div class="m-row"><span>Try it</span><button type="button" class="m-btn" data-do="breaknow">Roll a break now</button></div>`;
    case 'location': {
      const area = SECTIONS.find(s => s.id === 'area').nums;
      return `
      <div class="m-row"><span>ZIP code</span><input type="text" id="mZip" value="${esc(settings.zip)}" inputmode="numeric" maxlength="5"><button type="button" class="m-btn" data-do="zip">Look up</button></div>
      <p class="m-note" id="mPlace">${settings.place ? `📍 ${esc(settings.place.city)}, ${esc(settings.place.state)}` : ''}</p>
      <p class="m-note">Local TV lives on 6, 8, 9, 10, 12, 13 and 21–30. Paste a station’s YouTube channel link to air it live, or a website link for a “watch live” shortcut.</p>
      <div class="m-table m-stations">${area.map(n => {
        const c = chanByNum(n) || {};
        return `<div class="m-st" data-n="${n}"><b>${n}</b><input data-f="call" value="${esc(c.open ? '' : c.call || '')}" placeholder="CALL"><input data-f="name" value="${esc(c.open ? '' : c.name || '')}" placeholder="Station name">
          <input data-f="yt" value="${esc((c.yt || []).join(','))}" placeholder="YouTube link / ID"><input data-f="url" value="${esc(c.url || '')}" placeholder="https://… live page"></div>`;
      }).join('')}</div>
      <div class="m-row"><span></span><button type="button" class="m-btn" data-do="stations">Save stations</button></div>`;
    }
    case 'sources': {
      const local = SECTIONS.find(s => s.id === 'local').nums;
      const opts = [['', '— not set —'], ...libs.map(l => ['jellyfin:' + l.id, `Jellyfin › ${l.name}`]), ...folders.map(f => ['bridge:' + f, `Drive › ${f}`])];
      return `
      <h4>NostalgiaVue Bridge <small>(your PC’s drives over Tailscale)</small></h4>
      ${text('bridgeUrl', 'Bridge address', 'https://my-pc.tail1234.ts.net')}${text('bridgeToken', 'Bridge token', 'from bridge config.json', 'password')}
      <div class="m-row"><span></span><button type="button" class="m-btn" data-do="bridge">Test & load folders</button><em id="mBridge"></em></div>
      ${check('sync', 'Sync settings with my other devices (through the Bridge)')}
      <h4>Jellyfin</h4>
      ${text('jellyfinUrl', 'Server address', 'https://jellyfin.tail1234.ts.net')}${text('jellyfinKey', 'API key', 'Dashboard › API Keys', 'password')}
      <div class="m-row"><span></span><button type="button" class="m-btn" data-do="jellyfin">Test & load libraries</button><em id="mJelly"></em></div>
      <h4>YouTube <small>(the site’s own key is used automatically; set one here only to use your own quota)</small></h4>
      ${text('ytKey', 'API key', 'optional · AIza…', 'password')}
      <div class="m-row"><span></span><button type="button" class="m-btn" data-do="ytkey">Save & test</button><em id="mYT"></em></div>
      <p class="m-note">Unlocks ON DEMAND lists, Movie Night genres, the Elon Channel, seasonal fireplaces, and adding channels by @handle.</p>
      <h4>Local channels</h4>
      <div class="m-table">${local.map(n => {
        const m = settings.localMap[n], val = m ? (m.type === 'jellyfin' ? 'jellyfin:' + m.parentId : 'bridge:' + m.path) : '';
        const has = opts.some(o => o[0] === val);
        return `<div class="m-map" data-n="${n}"><b>${n}</b><select>${(has ? opts : [...opts, [val, m.label]]).map(([v, t]) => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
          <input placeholder="or type a folder, e.g. Videos/Cartoons" value="${m && m.type === 'bridge' && !has ? esc(m.path) : ''}"></div>`;
      }).join('')}</div>
      <div class="m-row"><span></span><button type="button" class="m-btn" data-do="map">Save local channels</button></div>`;
    }
    case 'channels': {
      const addable = SECTIONS.filter(s => s.add);
      const years = [['', 'Any']].concat(Array.from({ length: 14 }, (_, i) => { const y = 1900 + i * 10; return [y, String(y)]; }), [[new Date().getFullYear(), 'Today']]);
      const yearsTo = [['', 'Any']].concat(Array.from({ length: 13 }, (_, i) => { const y = 1909 + i * 10; return [y, String(y)]; }), [[new Date().getFullYear(), 'Today']]);
      return `
      <h4>Era <small>(only air content from these years: ${esc(eraLabel())})</small></h4>
      <div class="m-row m-eras">${[['', 'All'], [1950, '50s'], [1960, '60s'], [1970, '70s'], [1980, '80s'], [1990, '90s'], [2000, '00s'], [2010, '10s']].map(([y, t]) =>
        `<button type="button" class="m-btn${(settings.yearFrom || '') == y && (!y || settings.yearTo == y + 9) ? ' on' : ''}" data-do="era" data-y="${y}">${t}</button>`).join('')}</div>
      ${select('yearFrom', 'From', years)}${select('yearTo', 'To', yearsTo)}
      ${check('eraYouTube', 'Add the decade to YouTube searches too')}
      <p class="m-note">archive.org channels use the real air/release year. YouTube channels get the decade added to their search (one or two decades only). A channel with nothing from your era plays its normal lineup.</p>
      <h4>Add a channel</h4>
      <div class="m-add">
        <select id="aSec">${addable.map(s => `<option value="${s.id}">${s.label} (${s.from}–${s.to})</option>`).join('')}</select>
        <select id="aType"><option value="yt">YouTube channel / playlist / video</option><option value="archive">archive.org search</option><option value="stream">Stream URL (m3u8, mp4, mp3)</option><option value="m3u">M3U playlist (paste)</option><option value="web">Website shortcut / streaming service</option></select>
        <input id="aName" placeholder="Channel name">
        <textarea id="aVal" rows="2" placeholder="Link, ID, search words, or M3U text"></textarea>
        <div class="m-row"><span>Number</span><input id="aNum" type="number" min="1" max="599"><span class="a-prev" id="aPrev"></span></div>
        <button type="button" class="m-btn" data-do="add">Add channel</button><em id="aMsg"></em>
      </div>
      <h4>All channels <small>(${CHANNELS.length}) · uncheck to hide</small></h4>
      <div class="m-chlist">${CHANNELS.map(c => `<div class="m-ch"><span class="m-ico">${iconSVG(c)}</span><b>${c.n}</b><span>${esc(c.name)}</span>
        <input type="checkbox" data-hide="${c.n}" ${settings.hidden.includes(c.n) ? '' : 'checked'} aria-label="Show ${esc(c.name)}">
        ${c.user ? `<button type="button" class="m-x" data-del="${c.n}" aria-label="Delete">✕</button>` : '<i></i>'}</div>`).join('')}</div>`;
    }
    case 'parental': {
      const cats = [...new Set(CHANNELS.map(c => c.cat))].filter(Boolean).sort();
      return `
      <p class="m-note">Adult channels (${ADULT_CATS.join(', ')}, Lingerie Football) are always locked. Set a 4-digit PIN to unlock them and to lock anything else. Locked channels ask for the PIN (typed with the remote’s number buttons) and stay unlocked until the TV is turned off. The Kids profile hides everything except kids, cartoons, learning, nature and science channels; turning it off needs the PIN. Everything here is stored only on this device.</p>
      ${settings.adultOk
        ? '<div class="m-row"><span>Age</span><em>✓ Confirmed 18 or older on this device</em></div>'
        : '<div class="m-row"><span>Age</span><button type="button" class="m-btn" data-do="adult">I am 18 or older</button><em>Needed before a PIN can be set</em></div>'}
      <div class="m-row"><span>${pinSet() ? 'Change PIN' : 'Set a PIN'}</span><input type="password" id="mPin" inputmode="numeric" maxlength="4" placeholder="4 digits" autocomplete="off" ${settings.adultOk ? '' : 'disabled'}><button type="button" class="m-eye" data-eyeid="mPin" aria-label="Show or hide">👁</button><button type="button" class="m-btn" data-do="pin" ${settings.adultOk ? '' : 'disabled'}>Save PIN</button><em id="mPinMsg">${pinSet() ? 'PIN is set' : 'No PIN yet: only adult channels are locked'}</em></div>
      ${check('kids', 'Kids profile')}
      <h4>Locked categories</h4>
      <div class="m-cats">${cats.map(c => ADULT_CATS.includes(c)
        ? `<label class="m-cat" title="Always locked"><input type="checkbox" checked disabled> ${esc(c)} 🔒</label>`
        : `<label class="m-cat"><input type="checkbox" data-lockcat="${esc(c)}" ${(settings.lockedCats || []).includes(c) ? 'checked' : ''}> ${esc(c)}</label>`).join('')}</div>
      <h4>Locked channels</h4>
      <div class="m-row"><span>Channel numbers</span><input type="text" id="mLockCh" value="${esc((settings.lockedChannels || []).join(', '))}"><button type="button" class="m-btn" data-do="lockch">Save</button></div>`;
    }
    case 'stats': return `<div id="mStats"><p class="m-note">Counting…</p></div>
      ${check('shareStats', 'Share anonymous viewing counts (channel number and category only, no account)')}
      <div class="m-row"><span>This TV</span><button type="button" class="m-btn danger" data-do="resetstats">Reset my stats & ratings</button></div>`;
    case 'system': return `
      <div class="m-about">${lockup('color', 'mab')}<p>NostalgiaVue 1.0 · The picture of yesterday.</p></div>
      <div class="m-row"><span>Home screen</span>${installed() ? '<em>✓ Installed on this device</em>' : `<button type="button" class="m-btn" data-do="install">📲 Add to Home Screen</button><em id="mInstall"></em>`}</div>
      ${check('translate', 'Show Spanish and other foreign titles and descriptions in English')}
      ${check('cc', 'Closed captions / subtitles (also the CC button)')}
      <p class="m-note">Your settings, keys, PIN, favorites, tapes and resume points are stored only on this device (and on your own Bridge if you turn on sync). There are no accounts.</p>
      <div class="m-row"><span>Backup</span><button type="button" class="m-btn" data-do="export">Export settings</button><label class="m-btn">Import<input type="file" id="mImport" accept="application/json" hidden></label></div>
      <div class="m-row"><span>Reset</span><button type="button" class="m-btn danger" data-do="reset">Reset everything</button></div>
      <p class="m-note">Content plays from archive.org, YouTube and sources you add. NostalgiaVue doesn’t host any video.</p>`;
  }
  return '';
}

export function renderMenu() {
  const m = $('#menu');
  m.dataset.style = era();
  m.innerHTML = `<div class="m-head"><span>${era() === '80s' ? 'TV SETUP' : 'MENU'}</span><button type="button" class="m-close" data-do="close" aria-label="Close">✕</button></div>
    <nav class="m-tabs">${TABS.map(([k, t]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'on' : ''}">${t}</button>`).join('')}</nav>
    <div class="m-body">${body()}</div>`;
  if (tab === 'channels') { suggestNumber(); previewIcon(); }
  if (tab === 'stats') fillStats();
}

/* ---------- Stats tab ---------- */
function bars(entries, fmt, max = 10) {
  const rows = entries.filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, max);
  if (!rows.length) return '<p class="m-note">Nothing yet.</p>';
  const top = rows[0][1];
  return `<div class="st-bars">${rows.map(([label, v]) => `<div class="st-row"><span>${esc(label)}</span><i style="--w:${Math.max(3, v / top * 100)}%"></i><em>${fmt(v)}</em></div>`).join('')}</div>`;
}
const chLabel = n => { const c = chanByNum(+n); return c ? `${c.n} ${c.name}` : `Channel ${n}`; };
const mins = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
async function fillStats() {
  const box = $('#mStats'); if (!box) return;
  const me = myStats(), total = Object.values(me.ch).reduce((a, b) => a + b, 0);
  const days = Object.entries(me.days).sort().slice(-7).map(([d, v]) => [new Date(d + 'T12:00').toLocaleDateString([], { weekday: 'short' }), v]);
  const rated = Object.entries(me.rate).map(([n, v]) => [chLabel(n), v]);
  const cur = chanByNum(state.num);
  let html = `<h4>This TV <small>(since ${new Date(me.since).toLocaleDateString()})</small></h4>
    <div class="st-big"><b>${fmtMins(total)}</b><small>watched in all</small></div>
    ${cur ? `<div class="m-row"><span>Rate ${esc(cur.n + ' ' + cur.name)}</span>${starsHTML(cur.n)}</div>` : ''}
    <h5>Your most-watched channels</h5>${bars(Object.entries(me.ch).map(([n, v]) => [chLabel(n), v]), fmtMins)}
    <h5>By category</h5>${bars(Object.entries(me.cat), fmtMins, 12)}
    <h5>Last 7 days</h5>${bars(days, fmtMins, 7)}
    <h5>Your ratings</h5>${bars(rated, v => '★'.repeat(v), 20)}`;
  box.innerHTML = html;
  const all = await sharedSummary(true);
  if (!$('#mStats')) return;
  if (!all) {
    html += settings.shareStats === false
      ? '<h4>Everyone</h4><p class="m-note">Sharing is off, so the shared counts are hidden.</p>'
      : '<h4>Everyone</h4><p class="m-note">Shared counts (who’s watching what, most watched, average ratings) need the site’s free stats database. The site owner connects one in Vercel › Storage › Upstash for Redis. Until then, only this TV’s stats show.</p>';
  } else {
    const rt = Object.entries(all.ratings).filter(([, r]) => r.n >= 1).map(([n, r]) => [`${chLabel(n)} (${r.n})`, r.avg]);
    html += `<h4>Everyone</h4>
      <div class="st-big"><b>${all.live.total}</b><small>TVs on right now</small><b>${all.tvsToday}</b><small>TVs today</small></div>
      <h5>Watching right now</h5>${bars(Object.entries(all.live.by).map(([n, v]) => [chLabel(n), v]), v => `👁 ${v}`)}
      <h5>Most watched today</h5>${bars(Object.entries(all.today).map(([n, v]) => [chLabel(n), v]), mins)}
      <h5>Most watched of all time</h5>${bars(Object.entries(all.all).map(([n, v]) => [chLabel(n), v]), mins)}
      <h5>Top rated</h5>${bars(rt, v => '★ ' + v)}
      <h5>By category (everyone)</h5>${bars(Object.entries(all.cats), mins, 12)}`;
  }
  $('#mStats').innerHTML = html;
}
export function openMenu(t) {
  if (t) tab = t; state.menu = true;
  const m = $('#menu'), small = matchMedia('(max-width: 760px)').matches;
  m.classList.toggle('mobile', small);
  (small ? document.body : $('#tube')).appendChild(m);
  m.hidden = false; renderMenu(); setTimeout(() => $('#menu .m-tabs .on')?.focus(), 30);
}
export function closeMenu() { state.menu = false; $('#menu').hidden = true; document.activeElement?.blur?.(); }

function suggestNumber() {
  const s = $('#aSec')?.value; if (!s) return;
  const n = nextFree(s); $('#aNum').value = n ?? '';
}
function previewIcon() {
  const name = $('#aName')?.value || 'New Channel', n = +$('#aNum')?.value || 0, sec = SECTIONS.find(x => x.id === $('#aSec').value);
  $('#aPrev').innerHTML = iconSVG({ n, call: makeCall(name), cat: sec ? sec.label.split(' ')[0] : 'BYO' });
}

async function addChannel() {
  const secId = $('#aSec').value, type = $('#aType').value, name = $('#aName').value.trim(), val = $('#aVal').value.trim();
  let n = +$('#aNum').value; const sec = SECTIONS.find(s => s.id === secId), out = $('#aMsg');
  const cat = { nostalgia: 'MOVIES', youtube: 'YOUTUBE', podcasts: 'PODCASTS', more: 'MOVIES', byo: 'BYO', ppv: 'PPV' }[secId];
  if (!val) { out.textContent = 'Paste a link, ID or search first.'; return; }
  const add = (ch) => { settings.userChannels = settings.userChannels.filter(u => u.n !== ch.n).concat(ch); };
  if (type === 'm3u') {
    const items = parseM3U(val); if (!items.length) { out.textContent = 'No streams found in that playlist.'; return; }
    let k = 0;
    for (const it of items) { const free = nextFreeAfter(secId === 'byo' ? 'byo' : secId); if (!free) break; add({ n: free, cat, call: makeCall(it.name), name: it.name, kind: 'stream', url: it.url }); buildLineup(); k++; }
    changed(true); out.textContent = `Added ${k} channels.`; renderMenu(); return;
  }
  if (!n || n < 1 || n > 599) { out.textContent = 'Pick a channel number.'; return; }
  if (sectionOf(n)?.id !== secId) { out.textContent = `Use a number in ${sec.from}–${sec.to}.`; return; }
  const existing = chanByNum(n);
  if (existing && !existing.user) { out.textContent = `Channel ${n} is taken by ${existing.name}.`; return; }
  const base = { n, cat, name: name || 'Channel ' + n, call: makeCall(name || 'CH ' + n) };
  if (type === 'yt') {
    let id = parseYouTube(val), learned = null;
    if (!id && /@/.test(val)) { try { learned = await resolveHandle(val); id = learned?.id; } catch {} }
    if (!id) { out.textContent = 'Couldn’t find that channel. Use its /channel/UC… address, or make sure the YouTube key is set up.'; return; }
    add({ ...base, kind: 'yt', yt: [id], name: name || learned?.name || base.name, autoName: !name && !learned });
  }
  else if (type === 'archive') add({ ...base, kind: 'archive', q: [val], anyType: true });
  else if (type === 'stream') add({ ...base, kind: 'stream', url: val });
  else { try { new URL(val); } catch { out.textContent = 'Website shortcuts need a full https:// link.'; return; } add({ ...base, kind: 'external', url: val, ppv: secId === 'ppv' }); }
  changed(true); renderMenu(); $('#aMsg').textContent = `Added channel ${n}. Its logo was generated automatically.`;
}
function nextFreeAfter(secId) { return nextFree(secId); }

async function act(what, el) {
  el = el || {};
  if (what === 'close') return closeMenu();
  if (what === 'fullscreen') return hooks().fullscreen?.();
  if (what === 'breaknow') { closeMenu(); return hooks().breakNow?.(); }
  if (what === 'zip') {
    settings.zip = $('#mZip').value.trim(); settings.localStations = settings.localStations || null;
    $('#mPlace').textContent = 'Looking up…';
    try { const p = await resolvePlace(true); $('#mPlace').textContent = `📍 ${p.city}, ${p.state}`; } catch { $('#mPlace').textContent = 'Couldn’t find that ZIP.'; }
    return changed(true);
  }
  if (what === 'stations') {
    const o = {};
    $$('.m-st').forEach(r => {
      const n = +r.dataset.n, f = k => r.querySelector(`[data-f="${k}"]`).value.trim();
      const call = f('call'), name = f('name'), ytRaw = f('yt'), url = f('url');
      if (!call && !name && !ytRaw && !url) return;
      const cur = chanByNum(n) || {};
      const ids = ytRaw.split(',').map(parseYouTube).filter(Boolean);
      o[n] = { call: call || cur.call || 'CH' + n, name: name || cur.name || 'Channel ' + n, url, yt: ids, kind: ids.length ? 'yt' : (cur.kind === 'weather' || cur.kind === 'archive') ? cur.kind : 'station', open: false };
      if (cur.q && !ids.length) o[n].q = cur.q;
    });
    settings.localStations = o; changed(true); renderMenu(); return;
  }
  if (what === 'bridge') {
    const out = $('#mBridge'); out.textContent = 'Calling the Bridge…';
    try {
      const info = await bridgeApi('/api/info');
      const tree = await bridgeApi('/api/browse', { depth: 2 });
      folders = tree.dirs || [];
      out.textContent = `✓ ${info.name || 'Bridge'} online · ${folders.length} folders${info.roms ? ' · ROMs found' : ''}`;
      renderMenu(); $('#mBridge').textContent = out.textContent;
    } catch (e) {
      const code = String(e && e.message || '').split(' ')[0];
      out.textContent = code === '401' ? '✗ The Bridge answered but the token doesn’t match. Re-open the pairing link from the installer, or copy the token from config.json.'
        : /^\d{3}$/.test(code) ? `✗ The Bridge answered with error ${code}.`
        : !/^https:\/\//.test(settings.bridgeUrl) ? '✗ The address must start with https:// (your tailnet name, e.g. https://pc.tail1234.ts.net).'
        : `✗ Can’t reach ${settings.bridgeUrl}. Check: the Bridge is running on the PC, Tailscale is on here, and Chrome didn’t block “local network access” (allow it if asked). On the PC, the checkup script in the wiki pinpoints it.`;
    }
    return;
  }
  if (what === 'resetstats') {
    if (!confirm('Erase this TV’s watch history and ratings?')) return;
    resetMyStats(); renderMenu(); return;
  }
  if (what === 'adult') {
    if (!confirm('Adult channels have sexual content and drug references.\n\nPress OK only if you are 18 or older. This is remembered on this device.')) return;
    settings.adultOk = true; save(); renderMenu(); return;
  }
  if (what === 'ytkey') {
    const out = $('#mYT'); out.textContent = 'Asking YouTube…';
    try { const via = await testYouTube(); out.textContent = `✓ Saved. YouTube is working with ${via}.`; }
    catch (e) { out.textContent = '✗ ' + explainYtError(e.message); }
    return;
  }
  if (what === 'jellyfin') {
    const out = $('#mJelly'); out.textContent = 'Calling Jellyfin…';
    try { libs = await jellyfinLibraries(); const t = `✓ ${libs.length} libraries`; renderMenu(); $('#mJelly').textContent = t; }
    catch { out.textContent = '✗ No answer. Check the address, API key, and Tailscale.'; }
    return;
  }
  if (what === 'map') {
    const map = {};
    $$('.m-map').forEach(r => {
      const n = +r.dataset.n, sel = r.querySelector('select').value, typed = r.querySelector('input').value.trim().replace(/\\/g, '/');
      if (typed) map[n] = { type: 'bridge', path: typed, label: typed.split('/').pop() || typed };
      else if (sel.startsWith('jellyfin:')) { const id = sel.slice(9), l = libs.find(x => x.id === id); map[n] = { type: 'jellyfin', parentId: id, label: l ? l.name : (settings.localMap[n]?.label || 'Jellyfin') }; }
      else if (sel.startsWith('bridge:')) { const p = sel.slice(7); map[n] = { type: 'bridge', path: p, label: p.split('/').pop() }; }
    });
    settings.localMap = map; changed(true); renderMenu(); return;
  }
  if (what === 'add') return addChannel();
  if (what === 'pin') { const r = setPin($('#mPin').value.trim()); renderMenu(); $('#mPinMsg').textContent = r; return; }
  if (what === 'lockch') {
    if (!confirmPin('Change locked channels')) return renderMenu();
    settings.lockedChannels = $('#mLockCh').value.split(/[^0-9]+/).filter(Boolean).map(Number); changed(); renderMenu(); return;
  }
  if (what === 'era') {
    const y = el.dataset.y ? +el.dataset.y : null;
    settings.yearFrom = y; settings.yearTo = y ? y + 9 : null;
    changed(); renderMenu(); hooks().eraChanged?.(); return;
  }
  if (what === 'install') {
    if (installEvt) { installEvt.prompt(); installEvt.userChoice?.then(r => { if (r.outcome === 'accepted') renderMenu(); }); installEvt = null; return; }
    $('#mInstall').textContent = installHelp(); return;
  }
  if (what === 'export') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportSettings()], { type: 'application/json' }));
    a.download = 'nostalgiavue-settings.json'; a.click(); return;
  }
  if (what === 'reset') { if (confirm('Reset all NostalgiaVue settings and added channels?')) resetAll(); }
}

export function bindMenu() {
  const m = $('#menu');
  m.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; renderMenu(); $(`#menu [data-tab="${tab}"]`)?.focus(); return; }
    const eye = e.target.closest('[data-eye]');
    const eyeId = e.target.closest('[data-eyeid]');
    if (eyeId) { const inp = m.querySelector('#' + eyeId.dataset.eyeid); inp.type = inp.type === 'password' ? 'text' : 'password'; eyeId.classList.toggle('on', inp.type === 'text'); return; }
    if (eye) { e.preventDefault(); const inp = m.querySelector(`input[data-k="${eye.dataset.eye}"]`); const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; eye.classList.toggle('on', show); return; }
    const d = e.target.closest('[data-do]'); if (d) { act(d.dataset.do, d); return; }
    const del = e.target.closest('[data-del]'); if (del) { const n = +del.dataset.del; settings.userChannels = settings.userChannels.filter(u => u.n !== n); changed(true); renderMenu(); }
  });
  m.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.k && el.type === 'range') {
      settings[el.dataset.k] = +el.value; el.nextElementSibling.textContent = el.value; changed();
    }
    if (['aName', 'aNum'].includes(el.id)) previewIcon();
  });
  // keys, tokens and addresses save as you type, so nothing is lost if the menu closes first
  m.addEventListener('input', e => {
    const el = e.target, k = el.dataset.k;
    if (k && (el.type === 'text' || el.type === 'password') && typeof settings[k] === 'string') { settings[k] = el.value.trim(); save(); }
  });
  m.addEventListener('change', e => {
    const el = e.target, k = el.dataset.k;
    if (k === 'kids' && !el.checked && !confirmPin('Turn off the Kids profile')) { el.checked = true; return; }
    if (el.dataset.lockcat) {
      if (!confirmPin('Change locked categories')) { el.checked = !el.checked; return; }
      const c = el.dataset.lockcat; settings.lockedCats = (settings.lockedCats || []).filter(x => x !== c); if (el.checked) settings.lockedCats.push(c); changed(); return;
    }
    if (k && el.type !== 'range') {
      settings[k] = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' && /^\d+$/.test(el.value) ? +el.value : el.value.trim();
      if (k === 'yearFrom' || k === 'yearTo') settings[k] = el.value ? +el.value : null;
      changed(k === 'set'); if (k === 'set' || k.startsWith('year')) renderMenu();
      if (k === 'kids' && settings.kids && state.on) hooks().tune?.(state.num);
      if (k.startsWith('year') || k === 'eraYouTube') hooks().eraChanged?.();
      if (k === 'cc') { ytCaptions(); applySubs(); }
    }
    if (el.dataset.hide) {
      const n = +el.dataset.hide; settings.hidden = settings.hidden.filter(x => x !== n); if (!el.checked) settings.hidden.push(n); changed();
    }
    if (el.id === 'aSec') { suggestNumber(); previewIcon(); }
    if (el.id === 'mImport' && el.files[0]) el.files[0].text().then(t => { try { importSettings(t); location.reload(); } catch { alert('That file isn’t a NostalgiaVue settings backup.'); } });
  });
}

// Remote-control navigation inside the menu.
export function menuNav(key) {
  const items = $$('#menu button, #menu input, #menu select, #menu textarea').filter(x => x.offsetParent !== null && x.type !== 'file');
  let i = items.indexOf(document.activeElement);
  const el = items[i];
  if (key === 'up' || key === 'down') { i = (i + (key === 'down' ? 1 : -1) + items.length) % items.length; items[i]?.focus(); items[i]?.scrollIntoView({ block: 'nearest' }); return; }
  if (!el) { items[0]?.focus(); return; }
  if (key === 'left' || key === 'right') {
    const d = key === 'right' ? 1 : -1;
    if (el.type === 'range') { el.value = +el.value + d * (+el.step || 1) * (el.max > 10 ? 5 : 1); el.dispatchEvent(new Event('input', { bubbles: true })); }
    else if (el.tagName === 'SELECT') { el.selectedIndex = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + d)); el.dispatchEvent(new Event('change', { bubbles: true })); }
    else if (el.dataset.tab) { const tabs = $$('#menu [data-tab]'); const j = (tabs.indexOf(el) + d + tabs.length) % tabs.length; tabs[j].click(); }
    return;
  }
  if (key === 'ok') { if (el.type === 'checkbox') { el.checked = !el.checked; el.dispatchEvent(new Event('change', { bubbles: true })); } else el.click(); }
}
