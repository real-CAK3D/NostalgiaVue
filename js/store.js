// Persisted settings + live runtime state shared by every module.
const KEY = 'nostalgiavue.v1';

export const DEFAULTS = {
  // picture
  set: '90s-trino',      // a model id from js/sets.js
  remote: true,          // show the remote next to the set
  zoom: false,           // screen-only mode
  scanlines: 60,         // 0-100
  curvature: 70,         // vignette/glass strength 0-100
  mask: 35,              // RGB phosphor mask 0-100
  noise: 70,             // static loudness 0-100
  color: 100,            // saturation %
  brightness: 100,       // %
  logoIntro: true,       // NostalgiaVue splash on power-on
  guideStyle: 'prevue',  // see GUIDE_STYLES in guide.js
  changeFx: 'era',       // channel-change look: era | snow | blue | black | roll
  humBar: true,          // slow rolling hum bar on CRT sets
  glow: true,            // wall glow behind the set + darker room at night
  reception: true,       // 80s sets: weak channels get snow until you aim the rabbit ears
  antenna: 0,            // rabbit-ear angle (-60..60)
  warp: false,           // curved-glass picture (experimental)
  clock24: false,
  // sound
  vol: 0.7,
  muted: false,
  clicks: true,
  whine: false,
  // commercials
  ads: true,
  adEvery: 15,           // minutes of program between breaks
  adCount: 3,            // spots per break
  // location
  zip: '04240',
  place: null,           // {city, state, lat, lon} resolved from zip
  localStations: null,   // overrides for local-TV slots, by channel number
  // sources
  bridgeUrl: '',         // https://pc-name.tailnet.ts.net
  bridgeToken: '',
  jellyfinUrl: '',
  jellyfinKey: '',
  adultOk: false,         // "I'm 18 or older" confirmed on this device (needed to set a PIN)
  translate: true,
  shareStats: true,
  adultShown: false,      // adult channels on the dial (switched in service mode)
  xxxOn: false,           // XXX channel 599 turned on (with its password) on this device
  xxxLinks: [],           // video links for the XXX channel, kept on this device only       // send anonymous "watching channel N" check-ins for the shared counts        // show foreign-language descriptions in English
  ytKey: '',             // optional YouTube Data API key (search, ON DEMAND, @handles)
  ytNames: {},           // channel names learned from YouTube
  localMap: {},          // channel number -> {type:'bridge'|'jellyfin', path|parentId, label}
  // channels
  userChannels: [],      // channels added by the user (any section)
  hidden: [],            // channel numbers hidden from surfing + guide
  custom: '',            // search for the "your channel" slot
  // parental controls (nothing is locked until a PIN is set)
  pin: '',
  kids: false,           // Kids profile: only kid-friendly categories
  lockedCats: ['HALF BAKED', 'AFTER DARK'],
  lockedChannels: [34, 273, 274, 289, 290, 419, 846, 957],
  favorites: [],
  tapes: [],             // VCR tapes recorded with REC
  cc: false,
  signOff: true,         // 3–5 AM: classic cable channels air vintage sign-offs
  yearFrom: null,        // era selector: only air content from yearFrom..yearTo (null = any)
  yearTo: null,
  eraYouTube: true,      // also add the decade to YouTube searches
  // last state
  num: 31,
  sync: true,            // share settings with your other devices through the Bridge
  savedAt: 0,
};

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
export const settings = load();
// categories added after a TV first saved its settings start out locked there too
for (const cat of ['AFTER DARK']) {
  const seen = settings.lockSeen || (settings.lockSeen = []);
  if (seen.includes(cat)) continue;
  seen.push(cat);
  if (!settings.lockedCats.includes(cat)) settings.lockedCats = [...settings.lockedCats, cat];
}
export function save() {
  settings.savedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
  state.hooks?.onSave?.();
}
// store without bumping the timestamp (used when pulling synced settings)
export function saveQuiet() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {} }
export function resetAll() { try { localStorage.removeItem(KEY); } catch {} location.reload(); }
export function exportSettings() { return JSON.stringify(settings, null, 2); }
export function importSettings(text) {
  const o = JSON.parse(text);
  if (typeof o !== 'object' || !o) throw new Error('not a settings file');
  Object.assign(settings, DEFAULTS, o); save();
}

// Runtime state (not persisted).
export const state = {
  on: false,
  num: settings.num,
  prev: null,
  token: 0,          // bumps on every tune; async work checks it before touching the screen
  guide: false,
  guideSel: 0,
  menu: false,
  digits: '',
  inBreak: false,
  hooks: {},         // app-level callbacks registered by app.js (tune, step, ...)
};
export const live = () => state.on;
export const eraOn = () => !!(settings.yearFrom || settings.yearTo);
export const eraRange = () => [settings.yearFrom || 1890, settings.yearTo || new Date().getFullYear()];
export function eraLabel() {
  if (!eraOn()) return 'All years';
  const [a, b] = eraRange();
  return a % 10 === 0 && b === a + 9 ? `the ${a}s` : `${a}–${b}`;
}
// Words added to YouTube searches for the chosen era ("1990s", or "80s 90s" for two decades).
export function eraWords() {
  if (!eraOn() || !settings.eraYouTube) return '';
  const [a, b] = eraRange(), d0 = Math.floor(a / 10) * 10, d1 = Math.floor(b / 10) * 10;
  if (d0 === d1) return `${d0}s`;
  if (d1 - d0 === 10) return `${String(d0).slice(2)}s ${String(d1).slice(2)}s`;
  return '';
}
