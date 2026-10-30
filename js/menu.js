// On-screen TV settings (MENU button).
import { $, $$, esc } from './util.js';
import { settings, save, state, exportSettings, importSettings, resetAll } from './store.js';
import { SECTIONS, CHANNELS, buildLineup, chanByNum, nextFree, makeCall, sectionOf } from './lineup.js';
import { iconSVG } from './icons.js';
import { SETS } from './sets.js';
import { resolvePlace } from './sources/special.js';
import { bridgeApi, jellyfinLibraries, parseM3U } from './sources/local.js';
import { parseYouTube } from './sources/youtube.js';
import { lockup } from './logo.js';

const TABS = [['picture', 'Picture'], ['sound', 'Sound'], ['ads', 'Commercials'], ['location', 'Location'], ['sources', 'Sources'], ['channels', 'Channels'], ['system', 'System']];
let tab = 'picture', libs = [], folders = [], installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

const hooks = () => state.hooks;
const changed = (rebuild) => { save(); if (rebuild) { buildLineup(); hooks().lineupChanged?.(); } hooks().apply?.(); };

const range = (k, label, min = 0, max = 100, step = 1) => `<label class="m-row"><span>${label}</span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${settings[k]}"><output>${settings[k]}</output></label>`;
const check = (k, label) => `<label class="m-row m-check"><span>${label}</span><input type="checkbox" data-k="${k}" ${settings[k] ? 'checked' : ''}><i></i></label>`;
const select = (k, label, opts) => `<label class="m-row"><span>${label}</span><select data-k="${k}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(settings[k]) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
const text = (k, label, ph = '', type = 'text') => `<label class="m-row"><span>${label}</span><input type="${type}" data-k="${k}" value="${esc(settings[k] || '')}" placeholder="${esc(ph)}" autocomplete="off" spellcheck="false"></label>`;

function body() {
  switch (tab) {
    case 'picture': return `
      ${select('set', 'TV set', Object.entries(SETS).map(([k, s]) => [k, `${k === '80s' ? '1980s' : k === '90s' ? '1990s' : '2000s'} · NostalgiaVue ${s.model}`]))}
      ${check('remote', 'Show remote')}${check('zoom', 'Screen only (zoom)')}
      ${range('scanlines', 'Scanlines')}${range('mask', 'Phosphor mask')}${range('curvature', 'Glass & curve')}
      ${range('color', 'Color', 0, 160)}${range('brightness', 'Brightness', 50, 150)}
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
      <h4>Jellyfin</h4>
      ${text('jellyfinUrl', 'Server address', 'https://jellyfin.tail1234.ts.net')}${text('jellyfinKey', 'API key', 'Dashboard › API Keys', 'password')}
      <div class="m-row"><span></span><button type="button" class="m-btn" data-do="jellyfin">Test & load libraries</button><em id="mJelly"></em></div>
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
      return `
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
    case 'system': return `
      <div class="m-about">${lockup('color', 'mab')}<p>NostalgiaVue 1.0 · The picture of yesterday.</p></div>
      <div class="m-row"><span>Install</span><button type="button" class="m-btn" data-do="install">Install as an app</button></div>
      <div class="m-row"><span>Backup</span><button type="button" class="m-btn" data-do="export">Export settings</button><label class="m-btn">Import<input type="file" id="mImport" accept="application/json" hidden></label></div>
      <div class="m-row"><span>Reset</span><button type="button" class="m-btn danger" data-do="reset">Reset everything</button></div>
      <p class="m-note">Content plays from archive.org, YouTube and sources you add. NostalgiaVue doesn’t host any video.</p>`;
  }
  return '';
}

export function renderMenu() {
  const m = $('#menu');
  m.dataset.style = settings.set;
  m.innerHTML = `<div class="m-head"><span>${settings.set === '80s' ? 'TV SETUP' : 'MENU'}</span><button type="button" class="m-close" data-do="close" aria-label="Close">✕</button></div>
    <nav class="m-tabs">${TABS.map(([k, t]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'on' : ''}">${t}</button>`).join('')}</nav>
    <div class="m-body">${body()}</div>`;
  if (tab === 'channels') { suggestNumber(); previewIcon(); }
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

function addChannel() {
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
  if (type === 'yt') { const id = parseYouTube(val); if (!id) { out.textContent = 'That doesn’t look like a YouTube channel, playlist or video link. Use the /channel/UC… address.'; return; } add({ ...base, kind: 'yt', yt: [id] }); }
  else if (type === 'archive') add({ ...base, kind: 'archive', q: [val], anyType: true });
  else if (type === 'stream') add({ ...base, kind: 'stream', url: val });
  else { try { new URL(val); } catch { out.textContent = 'Website shortcuts need a full https:// link.'; return; } add({ ...base, kind: 'external', url: val, ppv: secId === 'ppv' }); }
  changed(true); renderMenu(); $('#aMsg').textContent = `Added channel ${n}. Its logo was generated automatically.`;
}
function nextFreeAfter(secId) { return nextFree(secId); }

async function act(what, el) {
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
    } catch (e) { out.textContent = '✗ No answer. Is the Bridge running and are you on Tailscale (https address)?'; }
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
  if (what === 'install') { if (installEvt) { installEvt.prompt(); installEvt = null; } else alert('On iPhone: Share › Add to Home Screen. On Android/desktop Chrome: menu › Install app.'); return; }
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
  m.addEventListener('change', e => {
    const el = e.target, k = el.dataset.k;
    if (k && el.type !== 'range') {
      settings[k] = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' && /^\d+$/.test(el.value) ? +el.value : el.value.trim();
      changed(k === 'set'); if (k === 'set') renderMenu();
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
