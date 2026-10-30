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
  ytKey: '',             // optional YouTube Data API key (search, ON DEMAND, @handles)
  ytNames: {},           // channel names learned from YouTube
  localMap: {},          // channel number -> {type:'bridge'|'jellyfin', path|parentId, label}
  // channels
  userChannels: [],      // channels added by the user (any section)
  hidden: [],            // channel numbers hidden from surfing + guide
  custom: '',            // search for the "your channel" slot
  // last state
  num: 31,
};

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
export const settings = load();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {} }
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
