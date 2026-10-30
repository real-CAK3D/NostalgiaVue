// Settings sync through the NostalgiaVue Bridge: every device on your tailnet shares channels,
// favorites, tapes, locks and picture settings. The newest save wins.
import { settings, state } from './store.js';
import { bridgeUrl, bridgeReady } from './sources/local.js';

const LOCAL_ONLY = new Set(['zoom', 'remote', 'num', 'bridgeUrl', 'bridgeToken', 'place']);
let timer = 0, pulling = false;

export async function pullSettings() {
  if (!settings.sync || !bridgeReady()) return false;
  try {
    const r = await fetch(bridgeUrl('/api/settings')); if (!r.ok) return false;
    const remote = await r.json();
    if (!remote || !remote.savedAt || remote.savedAt <= (settings.savedAt || 0)) return false;
    pulling = true;
    for (const [k, val] of Object.entries(remote)) if (!LOCAL_ONLY.has(k)) settings[k] = val;
    state.hooks.saveQuiet?.();
    pulling = false;
    return true;
  } catch { pulling = false; return false; }
}
export function pushSoon() {
  if (pulling || !settings.sync || !bridgeReady()) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const out = {}; for (const [k, val] of Object.entries(settings)) if (!LOCAL_ONLY.has(k)) out[k] = val;
    fetch(bridgeUrl('/api/settings'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }).catch(() => {});
  }, 2500);
}
