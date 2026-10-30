// Every TV noise is synthesized with WebAudio, so there are no sound files to ship.
import { settings } from './store.js';

let ctx = null, master, noiseBus, noiseGain, whineOsc, whineGain, toneOsc, toneGain, noiseBuf;

export function initSound() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // static hiss: bandpassed white noise with a little crackle
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = .35;
    noiseGain = ctx.createGain(); noiseGain.gain.value = 0;
    src.connect(bp).connect(noiseGain).connect(master); src.start();
    // flyback transformer whine (15.7 kHz, like a real NTSC set)
    whineOsc = ctx.createOscillator(); whineOsc.frequency.value = 15734;
    whineGain = ctx.createGain(); whineGain.gain.value = 0;
    whineOsc.connect(whineGain).connect(master); whineOsc.start();
    // test-pattern tone
    toneOsc = ctx.createOscillator(); toneOsc.frequency.value = 1000;
    toneGain = ctx.createGain(); toneGain.gain.value = 0;
    toneOsc.connect(toneGain).connect(master); toneOsc.start();
    noiseBus = noiseGain;
  } catch { ctx = null; }
}
const vol = () => settings.muted ? 0 : settings.vol;
const t = () => ctx.currentTime;

export function staticHiss(on) {
  if (!ctx) return;
  noiseGain.gain.setTargetAtTime(on ? .3 * vol() * (settings.noise / 100) : 0, t(), .015);
}
export function whine(on) {
  if (!ctx) return;
  whineGain.gain.setTargetAtTime(on && settings.whine ? .006 * vol() : 0, t(), .2);
}
export function tone(on) {
  if (!ctx) return;
  toneGain.gain.setTargetAtTime(on ? .05 * vol() : 0, t(), .02);
}

function burst({ dur = .03, freq = 3000, type = 'highpass', gain = .4, q = 1 }) {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(gain * vol(), t()); g.gain.exponentialRampToValueAtTime(.0001, t() + dur);
  s.connect(f).connect(g).connect(master); s.start(t(), Math.random()); s.stop(t() + dur + .02);
}
function osc({ type = 'sine', f0 = 440, f1 = f0, dur = .2, gain = .2, at = 0 }) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), s = t() + at;
  o.type = type; o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), s + dur);
  g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(gain * vol() + .0001, s + .01); g.gain.exponentialRampToValueAtTime(.0001, s + dur);
  o.connect(g).connect(master); o.start(s); o.stop(s + dur + .05);
}

// The remote's plasticky button click.
export function click() { if (settings.clicks) burst({ dur: .025, freq: 2500, gain: .35 }); }
// Relay "tick" inside the set when the tuner changes channel.
export function relay() { burst({ dur: .04, freq: 900, type: 'bandpass', gain: .5, q: 3 }); }
// The 80s set's mechanical dial: a heavy detent clunk.
export function clunk() { osc({ type: 'triangle', f0: 160, f1: 60, dur: .12, gain: .5 }); burst({ dur: .06, freq: 600, type: 'lowpass', gain: .6 }); }
// 2000s set: digital beep on every button.
export function beep() { osc({ type: 'square', f0: 1850, dur: .05, gain: .06 }); }
// Power on: relay clack, degauss "thwump-buzz", then high voltage settles.
export function powerOn() {
  relay();
  osc({ type: 'sawtooth', f0: 60, f1: 50, dur: .9, gain: .12, at: .05 });
  osc({ type: 'sine', f0: 120, f1: 40, dur: .5, gain: .35, at: .05 });
  burst({ dur: .5, freq: 300, type: 'lowpass', gain: .25 });
  setTimeout(() => whine(true), 600);
}
export function powerOff() {
  relay(); whine(false); staticHiss(false); tone(false);
  osc({ type: 'sine', f0: 900, f1: 40, dur: .35, gain: .05 });
}
// NostalgiaVue sonic logo: bright four-note arpeggio with a shimmer.
export function chime() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    osc({ type: 'triangle', f0: f, dur: .9 - i * .1, gain: .16, at: i * .11 });
    osc({ type: 'sine', f0: f * 2, dur: .5, gain: .04, at: i * .11 + .02 });
  });
}
// "We'll be right back" bumper sting.
export function sting() {
  [392, 523.25, 659.25].forEach((f, i) => osc({ type: 'square', f0: f, dur: .25, gain: .05, at: i * .14 }));
  osc({ type: 'triangle', f0: 784, dur: .6, gain: .12, at: .42 });
}
export function remoteClick(set) {
  if (set === '80s') clunk(); else if (set === '00s') beep(); else click();
}
export const soundReady = () => !!ctx;
