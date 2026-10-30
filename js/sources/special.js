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

const deg = v => Math.round(v) + '°';
const SEC = 1000;
async function radarFrames() {
  const j = await fetchJSON('https://api.rainviewer.com/public/weather-maps.json');
  return { host: j.host, radar: (j.radar?.past || []).concat(j.radar?.nowcast || []), clouds: (j.satellite?.infrared || []).slice(-1)[0] || null };
}
// Regional Doppler: CARTO basemap + RainViewer satellite clouds + animated radar, built from <img> tiles.
function radarHTML(place, rv) {
  const z = 6, n = 2 ** z, lat = place.lat * Math.PI / 180;
  const xf = (place.lon + 180) / 360 * n, yf = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n;
  const tx0 = Math.floor(xf) - 2, ty0 = Math.floor(yf) - 2;
  const tiles = (url, cls = '', style = '') => {
    let h = ''; for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const x = ((tx0 + i) % n + n) % n, y = ty0 + j; if (y < 0 || y >= n) continue;
      h += `<img src="${url(x, y)}" style="left:calc(var(--t)*${i});top:calc(var(--t)*${j})" alt="" loading="eager" onerror="this.style.visibility='hidden'">`;
    }
    return `<div class="rlayer ${cls}" style="${style}">${h}</div>`;
  };
  const base = tiles((x, y) => `https://basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`, 'base');
  const labels = tiles((x, y) => `https://basemaps.cartocdn.com/dark_only_labels/${z}/${x}/${y}.png`, 'labels');
  const clouds = rv && rv.clouds ? tiles((x, y) => `${rv.host}${rv.clouds.path}/256/${z}/${x}/${y}/0/0_0.png`, 'clouds') : '';
  const frames = rv ? rv.radar.map((f, k) => tiles((x, y) => `${rv.host}${f.path}/256/${z}/${x}/${y}/4/1_1.png`, 'frame', `opacity:${k === rv.radar.length - 1 ? 1 : 0}`)).join('') : '';
  return `<div class="radar"><div class="rmap" style="left:calc(50% - var(--t)*${(xf - tx0).toFixed(4)});top:calc(50% - var(--t)*${(yf - ty0).toFixed(4)})">${base}${clouds}${frames}${labels}</div>
    <div class="rpin"><i></i><span>${esc(place.city)}</span></div><div class="rstamp"></div><div class="rkey"><span>LIGHT</span><b></b><span>HEAVY</span></div></div>`;
}

export async function tuneWeather(ch, token) {
  scene(`<div class="wx"><div class="wx-head"><span class="wx-logo">${lockup('white', 'wxl')}</span><span class="wx-title">WEATHER STATION</span><span class="wx-clock"></span></div>
    <div class="wx-body"><div class="wx-loading">Contacting the satellite…</div></div><div class="wx-crawl"><span></span></div></div>`, 'weather');
  staticOff(); hideMsg();
  bgMusic(90009, [TS('smooth jazz', 'weather channel music', 'local on the 8s'), 'subject:"smooth jazz"', 'subject:jazz'], token);
  let place, data, rv = null;
  try {
    place = await resolvePlace();
    const p = new URLSearchParams({
      latitude: place.lat, longitude: place.lon, timezone: 'auto', forecast_days: '8', temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', precipitation_unit: 'inch',
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,visibility,cloud_cover,dew_point_2m',
      hourly: 'temperature_2m,weather_code,precipitation_probability',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,snowfall_sum,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset',
    });
    [data, rv] = await Promise.all([fetchJSON(`https://api.open-meteo.com/v1/forecast?${p}`), radarFrames().catch(() => null)]);
  } catch {
    if (token === state.token) document.querySelector('.wx-body').innerHTML = '<div class="wx-loading">The weather satellite is down. Check the ZIP code in MENU › Location.</div>';
    return;
  }
  if (token !== state.token) return;
  const c = data.current, d = data.daily, H = data.hourly, where = `${place.city}, ${place.state}`, h24 = settings.clock24;
  const nowIdx = Math.max(0, H.time.findIndex(t => Date.parse(t) >= Date.now() - 3600e3));
  const dayCard = (i, big) => `<div class="wx-day${big ? ' big' : ''}"><b>${i === 0 ? 'TODAY' : day(d.time[i], !big)}</b><span class="wx-ico">${wx(d.weather_code[i])[1]}</span><small>${wx(d.weather_code[i])[0]}</small>
    <strong>${deg(d.temperature_2m_max[i])}</strong><em>${deg(d.temperature_2m_min[i])}</em><i>💧 ${d.precipitation_probability_max[i] ?? 0}%</i></div>`;
  const narrative = i => {
    const w = wx(d.weather_code[i])[0].toLowerCase(), pp = d.precipitation_probability_max[i] ?? 0, sn = d.snowfall_sum?.[i] || 0;
    return `<p><b>${i === 0 ? 'TODAY' : day(d.time[i])}…</b> ${w.replace(/^./, m => m.toUpperCase())}. High ${Math.round(d.temperature_2m_max[i])}. ${dir(d.wind_direction_10m_dominant[i])} winds up to ${Math.round(d.wind_speed_10m_max[i])} mph. ${pp >= 20 ? `Chance of ${sn > 0 ? 'snow' : 'precipitation'} ${pp} percent.` : ''}${sn > .2 ? ` Snow accumulation around ${sn.toFixed(1)} inches.` : ''}</p>
      <p><b>${i === 0 ? 'TONIGHT' : day(d.time[i]) + ' NIGHT'}…</b> Low around ${Math.round(d.temperature_2m_min[i + 1] ?? d.temperature_2m_min[i])}.</p>`;
  };
  const pages = [
    [10, () => `<h2>Current Conditions</h2><div class="wx-cur"><div class="wx-big"><div class="wx-t">${deg(c.temperature_2m)}</div><div class="wx-ico">${wx(c.weather_code)[1]}</div><div>${wx(c.weather_code)[0]}</div></div>
      <dl><dt>${esc(where)}</dt><dd></dd><dt>Humidity</dt><dd>${c.relative_humidity_2m}%</dd><dt>Dewpoint</dt><dd>${deg(c.dew_point_2m)}</dd><dt>Feels Like</dt><dd>${deg(c.apparent_temperature)}</dd>
      <dt>Wind</dt><dd>${dir(c.wind_direction_10m)} ${Math.round(c.wind_speed_10m)}${c.wind_gusts_10m > c.wind_speed_10m + 5 ? ` G${Math.round(c.wind_gusts_10m)}` : ''} mph</dd><dt>Pressure</dt><dd>${(c.surface_pressure * 0.02953).toFixed(2)} in</dd>
      <dt>Cloud Cover</dt><dd>${c.cloud_cover}%</dd><dt>Visibility</dt><dd>${c.visibility != null ? Math.round(c.visibility / 1609) + ' mi' : '—'}</dd></dl></div>`],
    [16, () => `<h2>Doppler Radar</h2>${radarHTML(place, rv)}`, 'radar'],
    [10, () => `<h2>Today’s Forecast</h2><div class="wx-today">${dayCard(0, true)}<dl><dt>Precipitation</dt><dd>${(d.precipitation_sum[0] || 0).toFixed(2)} in</dd><dt>Max Wind</dt><dd>${dir(d.wind_direction_10m_dominant[0])} ${Math.round(d.wind_speed_10m_max[0])} mph</dd>
      <dt>UV Index</dt><dd>${Math.round(d.uv_index_max[0] ?? 0)}</dd><dt>Sunrise</dt><dd>${fmtTime(Date.parse(d.sunrise[0]), h24)}</dd><dt>Sunset</dt><dd>${fmtTime(Date.parse(d.sunset[0]), h24)}</dd></dl></div>`],
    [10, () => `<h2>The Next 12 Hours</h2><div class="wx-hours">${H.time.slice(nowIdx, nowIdx + 12).map((t, k) => { const i = nowIdx + k, tp = H.temperature_2m[i];
      return `<div><em>${new Date(t).toLocaleTimeString([], { hour: 'numeric', hour12: !h24 })}</em><span class="bar" style="height:${Math.max(8, (tp - 0) * .9)}%"></span><b>${deg(tp)}</b><span class="wx-ico s">${wx(H.weather_code[i])[1]}</span><small>${H.precipitation_probability[i] ?? 0}%</small></div>`; }).join('')}</div>`],
    [10, () => `<h2>3-Day Outlook</h2><div class="wx-days three">${[0, 1, 2].map(i => dayCard(i, true)).join('')}</div>`],
    [10, () => `<h2>5-Day Forecast</h2><div class="wx-days five">${[1, 2, 3, 4, 5].map(i => dayCard(i)).join('')}</div>`],
    [10, () => `<h2>7-Day Forecast</h2><div class="wx-days seven">${[1, 2, 3, 4, 5, 6, 7].filter(i => d.time[i]).map(i => dayCard(i)).join('')}</div>`],
    [12, () => `<h2>Local Forecast</h2><div class="wx-text">${narrative(0)}${narrative(1)}${narrative(2)}</div>`],
    [8, () => `<h2>Almanac</h2><div class="wx-text"><p><b>Sunrise</b> ${fmtTime(Date.parse(d.sunrise[0]), h24)} &nbsp; <b>Sunset</b> ${fmtTime(Date.parse(d.sunset[0]), h24)}</p>
      <p>Tomorrow: sunrise ${fmtTime(Date.parse(d.sunrise[1]), h24)}, sunset ${fmtTime(Date.parse(d.sunset[1]), h24)}.</p><p>UV index today: ${Math.round(d.uv_index_max[0] ?? 0)}.</p><p>Brought to you by NostalgiaVue — the picture of yesterday.</p></div>`],
  ];
  document.querySelector('.wx-crawl span').textContent =
    `${where.toUpperCase()} — Currently ${wx(c.weather_code)[0].toLowerCase()} and ${Math.round(c.temperature_2m)} degrees. ` +
    d.time.slice(0, 7).map((t, i) => `${i ? day(t) : 'TODAY'}: ${wx(d.weather_code[i])[0]}, high ${Math.round(d.temperature_2m_max[i])}, low ${Math.round(d.temperature_2m_min[i])}.`).join(' ') + ' • Stay tuned to NostalgiaVue. •';
  let page = -1, until = 0, frame = 0;
  while (token === state.token) {
    const body = document.querySelector('.wx-body'), clock = document.querySelector('.wx-clock');
    if (!body) return;
    clock.textContent = new Date().toLocaleString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: !h24 });
    if (Date.now() >= until) {
      page = (page + 1) % pages.length;
      if (pages[page][2] === 'radar' && !rv) page = (page + 1) % pages.length;
      body.innerHTML = pages[page][1](); until = Date.now() + pages[page][0] * SEC; frame = 0;
      body.classList.remove('slide'); void body.offsetWidth; body.classList.add('slide');
    }
    // animate the radar loop; hold on the newest frame
    const fr = body.querySelectorAll('.frame');
    if (fr.length) {
      const k = Math.min(frame, fr.length - 1);
      fr.forEach((el, i) => { el.style.opacity = i === k ? .85 : 0; });
      const f = rv.radar[k], st = body.querySelector('.rstamp');
      if (st && f) st.textContent = new Date(f.time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !h24 }) + (k >= rv.radar.length - (rv.radar.length > 13 ? 3 : 1) ? ' · NOW' : '');
      frame = frame >= fr.length + 3 ? 0 : frame + 1;
      await sleep(450);
    } else await sleep(1000);
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
