// Show descriptions and titles in English when they're in another language (archive.org has
// plenty in Spanish). Uses the browser's own on-device translator when it has one (recent Chrome),
// otherwise MyMemory's free translation service. Results are remembered on this device.
import { settings } from './store.js';
import { fetchJSON } from './util.js';

const KEY = 'nv.translations';
let memo = {}; try { memo = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
function keep() {
  const k = Object.keys(memo); if (k.length > 500) k.slice(0, k.length - 500).forEach(x => delete memo[x]);
  try { localStorage.setItem(KEY, JSON.stringify(memo)); } catch {}
}

// a quick check for Spanish when the browser can't detect languages itself
const ES = /\b(el|la|los|las|del|que|una|por|para|con|est[aá]|pel[ií]cula|tambi[eé]n|sobre|a[nñ]os|y|en|de|su|se|es|un)\b/gi;
const EN = /\b(the|and|of|to|is|in|with|for|this|that|on|from)\b/gi;
function guess(t) {
  const es = (t.match(ES) || []).length, en = (t.match(EN) || []).length;
  return es >= 3 && es > en * 2 ? 'es' : 'en';
}
// the browser's models can be mid-download; never wait long on them
const within = (pr, ms = 2500) => Promise.race([pr, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
async function detect(t) {
  try {
    if ('LanguageDetector' in self && (await within(LanguageDetector.availability())) === 'available') {
      const [r] = await within((await within(LanguageDetector.create())).detect(t));
      if (r && r.confidence > 0.6) return r.detectedLanguage;
    }
  } catch {}
  return guess(t);
}
async function viaMyMemory(t, lang) {
  const parts = t.match(/[\s\S]{1,450}(?=[.!?]\s|$)[.!?]?|[\s\S]{1,450}/g) || [t];
  const out = [];
  for (const p of parts.slice(0, 4)) {
    const j = await fetchJSON(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(p.trim())}&langpair=${lang}|en`);
    const r = j.responseData?.translatedText;
    if (!r || j.responseStatus !== 200) throw new Error('no translation');
    out.push(r);
  }
  return out.join(' ');
}

// -> { text, from } ; from is the source language when it was translated
export async function toEnglish(text) {
  const t = String(text || '').trim().slice(0, 1800);
  if (!settings.translate || t.length < 12) return { text };
  if (memo[t]) return memo[t];
  const lang = await detect(t);
  if (!lang || lang.startsWith('en') || lang === 'und') return { text };
  let out = null;
  try {
    const pair = { sourceLanguage: lang, targetLanguage: 'en' };
    if ('Translator' in self && (await within(Translator.availability(pair))) === 'available') out = await within((await within(Translator.create(pair))).translate(t), 8000);
  } catch {}
  if (!out) { try { out = await viaMyMemory(t, lang); } catch {} }
  if (!out) return { text };
  const res = { text: out, from: lang };
  memo[t] = res; keep();
  return res;
}
const NAMES = { es: 'Spanish', pt: 'Portuguese', fr: 'French', it: 'Italian', de: 'German', ru: 'Russian', ja: 'Japanese', zh: 'Chinese' };
export const langName = l => NAMES[l] || l;
