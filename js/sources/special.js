// Channels that aren't a stream of programs: weather, the guide channel, PPV/station cards, test pattern.
import { esc, fetchJSON, fmtTime, sleep } from '../util.js';
import { settings, save, state } from '../store.js';
import { staticOff, scene, bars, hideMsg } from '../osd.js';
import { tuneArchive } from './archive.js';
import { iconSVG } from '../icons.js';
import { CHANNELS, isHidden, TS } from '../lineup.js';
import { guideGridHTML } from '../guide.js';
import { lockup } from '../logo.js';

const bgMusic = (n, q, token) => tuneArchive({ n, call: 'BG', name: 'bg', q, audio: true }, token, { bg: true });

/* ---------- location ---------- */
export async function resolvePlace(force) {
  if (settings.place && settings.place.zip === settings.zip && !force) return settings.place;
  const j = await fetchJSON(`https://api.zippopotam.us/us/${encodeURIComponent(settings.zip)}`);
  const p = j.places && j.places[0];
  if (!p) throw new Error('zip');
  settings.place = { zip: settings.zip, city: p['place name'], state: p['state abbreviation'], lat: +p.latitude, lon: +p.longitude };
  save();
  return settings.place;
}

/* ---------- weather ("Local on the 9s") ---------- */
const WMO = {
  0: ['Sunny', '☀'], 1: ['Mostly Sunny', '🌤'], 2: ['Partly Cloudy', '⛅'], 3: ['Cloudy', '☁'], 45: ['Fog', '🌫'], 48: ['Freezing Fog', '🌫'],
  51: ['Drizzle', '🌦'], 53: ['Drizzle', '🌦'], 55: ['Heavy Drizzle', '🌧'], 56: ['Frz Drizzle', '🌧'], 57: ['Frz Drizzle', '🌧'],
  61: ['Light Rain', '🌦'], 63: ['Rain', '🌧'], 65: ['Heavy Rain', '🌧'], 66: ['Freezing Rain', '🌧'], 67: ['Freezing Rain', '🌧'],
  71: ['Light Snow', '🌨'], 73: ['Snow', '🌨'], 75: ['Heavy Snow', '❄'], 77: ['Flurries', '🌨'], 80: ['Showers', '🌦'], 81: ['Showers', '🌧'],
  82: ['Downpours', '🌧'], 85: ['Snow Showers', '🌨'], 86: ['Snow Showers', '❄'], 95: ['T-Storms', '⛈'], 96: ['T-Storms', '⛈'], 99: ['T-Storms', '⛈'],
};
const wx = c => WMO[c] || ['—', '·'];
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const dir = d => DIRS[Math.round(((d % 360) + 360) % 360 / 45) % 8];
const day = (iso, short) => new Date(iso + 'T12:00').toLocaleDateString([], { weekday: short ? 'short' : 'long' }).toUpperCase();

export async function tuneWeather(ch, token) {
  scene(`<div class="wx"><div class="wx-head"><span class="wx-logo">${lockup('white', 'wxl')}</span><span class="wx-title">LOCAL FORECAST</span><span class="wx-clock"></span></div>
    <div class="wx-body"><div class="wx-loading">Contacting the satellite…</div></div><div class="wx-crawl"><span></span></div></div>`, 'weather');
  staticOff(); hideMsg();
  bgMusic(90009, [TS('smooth jazz', 'weather channel music', 'local on the 8s'), 'subject:"smooth jazz"', 'subject:jazz'], token);
  let place, data;
  try {
    place = await resolvePlace();
    const p = new URLSearchParams({
      latitude: place.lat, longitude: place.lon, timezone: 'auto', forecast_days: '7', temperature_unit: 'fahrenheit', wind_speed_unit: 'mph',
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,visibility',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    });
    data = await fetchJSON(`https://api.open-meteo.com/v1/forecast?${p}`);
  } catch {
    if (token === state.token) document.querySelector('.wx-body').innerHTML = '<div class="wx-loading">The weather satellite is down. Check the ZIP code in MENU › Location.</div>';
    return;
  }
  if (token !== state.token) return;
  const c = data.current, d = data.daily, where = `${place.city}, ${place.state}`;
  const pages = [
    () => `<h2>Current Conditions</h2><div class="wx-cur"><div class="wx-big"><div class="wx-t">${Math.round(c.temperature_2m)}°</div><div class="wx-ico">${wx(c.weather_code)[1]}</div><div>${wx(c.weather_code)[0]}</div></div>
      <dl><dt>${esc(where)}</dt><dd></dd><dt>Humidity</dt><dd>${c.relative_humidity_2m}%</dd><dt>Feels Like</dt><dd>${Math.round(c.apparent_temperature)}°</dd>
      <dt>Wind</dt><dd>${dir(c.wind_direction_10m)} ${Math.round(c.wind_speed_10m)} mph</dd><dt>Pressure</dt><dd>${(c.surface_pressure * 0.02953).toFixed(2)} in</dd>
      <dt>Visibility</dt><dd>${c.visibility != null ? Math.round(c.visibility / 1609) + ' mi' : '—'}</dd></dl></div>`,
    () => `<h2>Local Forecast</h2><div class="wx-text"><p><b>${day(d.time[0])}…</b> ${wx(d.weather_code[0])[0]}. High ${Math.round(d.temperature_2m_max[0])}. Chance of precipitation ${d.precipitation_probability_max[0] ?? 0} percent.</p>
      <p><b>TONIGHT…</b> Low around ${Math.round(d.temperature_2m_min[1] ?? d.temperature_2m_min[0])}.</p>
      <p><b>${day(d.time[1])}…</b> ${wx(d.weather_code[1])[0]}. High ${Math.round(d.temperature_2m_max[1])}.</p></div>`,
    () => `<h2>Extended Forecast</h2><div class="wx-ext">${d.time.slice(1, 6).map((t, i) => `<div><b>${day(t, true)}</b><span class="wx-ico">${wx(d.weather_code[i + 1])[1]}</span><small>${wx(d.weather_code[i + 1])[0]}</small><em>Lo ${Math.round(d.temperature_2m_min[i + 1])}</em><strong>Hi ${Math.round(d.temperature_2m_max[i + 1])}</strong></div>`).join('')}</div>`,
    () => `<h2>Almanac</h2><div class="wx-text"><p><b>Sunrise</b> ${fmtTime(Date.parse(d.sunrise[0]), settings.clock24)} &nbsp; <b>Sunset</b> ${fmtTime(Date.parse(d.sunset[0]), settings.clock24)}</p>
      <p>Tomorrow: sunrise ${fmtTime(Date.parse(d.sunrise[1]), settings.clock24)}, sunset ${fmtTime(Date.parse(d.sunset[1]), settings.clock24)}.</p><p>Brought to you by NostalgiaVue — the picture of yesterday.</p></div>`,
  ];
  document.querySelector('.wx-crawl span').textContent =
    `${where.toUpperCase()} — Currently ${wx(c.weather_code)[0].toLowerCase()} and ${Math.round(c.temperature_2m)} degrees. ` +
    d.time.slice(0, 7).map((t, i) => `${day(t)}: ${wx(d.weather_code[i])[0]}, high ${Math.round(d.temperature_2m_max[i])}, low ${Math.round(d.temperature_2m_min[i])}.`).join(' ') + ' • Stay tuned to NostalgiaVue. •';
  let i = 0;
  while (token === state.token) {
    const body = document.querySelector('.wx-body'), clock = document.querySelector('.wx-clock');
    if (!body) return;
    clock.textContent = new Date().toLocaleString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: !settings.clock24 });
    if (i % 8 === 0) { body.innerHTML = pages[(i / 8) % pages.length](); body.classList.remove('slide'); void body.offsetWidth; body.classList.add('slide'); }
    i++; await sleep(1000);
  }
}

/* ---------- the NostalgiaVue Guide channel ---------- */
export async function tuneGuideChannel(ch, token) {
  staticOff(); hideMsg();
  scene(`<div class="gch"><div class="gch-top"><div class="gch-promo"></div><div class="gch-side">${lockup('white', 'gchl')}<div class="gch-clock"></div><div class="gch-tag">THE GUIDE CHANNEL</div></div></div>
    <div class="gch-grid"></div></div>`, 'guidech');
  bgMusic(90031, [S_LOUNGE], token);
  const promos = CHANNELS.filter(c => !isHidden(c.n) && (c.kind === 'archive' || c.kind === 'yt'));
  let row = 0, tick = 0;
  while (token === state.token) {
    const grid = document.querySelector('.gch-grid'); if (!grid) return;
    if (tick % 3 === 0) {
      grid.innerHTML = guideGridHTML({ start: row, count: 7, auto: true });
      row = (row + 1) % CHANNELS.length;
    }
    if (tick % 8 === 0) {
      const p = promos[Math.floor(Math.random() * promos.length)];
      document.querySelector('.gch-promo').innerHTML = `<div class="promo">${iconSVG(p)}<div><small>COMING UP ON</small><b>${p.n} · ${esc(p.name)}</b><em>${esc(p.desc || p.cat.toLowerCase().replace(/^./, m => m.toUpperCase()) + ' all day, every day.')}</em></div></div>`;
    }
    document.querySelector('.gch-clock').textContent = new Date().toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: !settings.clock24 });
    tick++; await sleep(1000);
  }
}
const S_LOUNGE = 'subject:("easy listening" OR lounge OR muzak OR "smooth jazz")';

/* ---------- PPV / streaming shortcuts / local stations without a feed ---------- */
export function tuneCard(ch) {
  staticOff(); hideMsg();
  const ppv = ch.sec === 'ppv' || ch.ppv || ch.cat === 'PPV';
  const station = ch.kind === 'station';
  const text = station
    ? (ch.url ? 'This station streams live on its own website.' : ch.open ? 'This channel is open. Add a station in MENU › Location.' : 'Add a YouTube channel or live link for this station in MENU › Location.')
    : ch.desc || 'This channel lives on another service. Switching input…';
  scene(`<div class="card ${ppv ? 'ppv' : station ? 'station' : ''}">
    ${ppv ? '<div class="ppv-head">PAY-PER-VIEW · PRESS OK TO ORDER · $0.00</div>' : ''}
    <div class="card-icon">${iconSVG(ch)}</div><div class="card-name">${esc(ch.name)}</div>
    <div class="card-text">${esc(text)}</div>
    ${ch.url ? `<button type="button" class="card-go" data-url="${esc(ch.url)}">▶ ${ppv ? 'ORDER / OPEN' : 'WATCH LIVE'} — ${esc(new URL(ch.url).hostname.replace(/^www\./, ''))}</button>` : ''}
    ${ppv ? '<div class="ppv-fine">Opens in a new tab. NostalgiaVue will keep the set warm on INPUT 2.</div>' : ''}</div>`, 'cardscene');
  const go = document.querySelector('.card-go');
  if (go) go.onclick = () => openExternal(ch);
}
export function openExternal(ch) {
  if (!ch.url) return;
  window.open(ch.url, '_blank', 'noopener');
  bars('INPUT 2', `Watching ${ch.name} in another tab`);
}

export function tuneBars() { bars('', '', true); }
