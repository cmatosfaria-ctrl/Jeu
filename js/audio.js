// Sons synthétisés (aucun fichier audio) + vibrations.
import { load } from './storage.js';

let ctx = null;
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.15, at = 0, slide = 0 } = {}) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

// Souffle de vapeur : bruit blanc filtré
function steam(dur = 0.35, vol = 0.06, freq = 2500) {
  const a = ac(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8; g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

function bubbles(n = 6, base = 380) {
  for (let i = 0; i < n; i++) tone(base + Math.random() * 300, 0.07, { at: i * 0.05, vol: 0.06, slide: 250, type: 'sine' });
}

const SOUNDS = {
  select: () => tone(660, 0.06, { vol: 0.07, type: 'triangle' }),
  pour: () => { bubbles(7, 300); steam(0.4, 0.04, 3000); },
  fill: () => bubbles(5, 420),
  empty: () => { steam(0.5, 0.08, 1800); tone(300, 0.3, { vol: 0.05, slide: -220, type: 'sawtooth' }); },
  place: () => { tone(180, 0.05, { vol: 0.12, type: 'square' }); tone(90, 0.08, { at: 0.03, vol: 0.1, type: 'triangle' }); },
  rotate: () => tone(440, 0.04, { vol: 0.06, type: 'triangle' }),
  error: () => { tone(160, 0.18, { vol: 0.12, type: 'square' }); },
  deliver: () => { tone(784, 0.12, { vol: 0.1 }); tone(1046, 0.2, { at: 0.1, vol: 0.1 }); },
  coin: () => { tone(988, 0.08, { vol: 0.08, type: 'square' }); tone(1319, 0.2, { at: 0.08, vol: 0.08, type: 'square' }); },
  win: () => { steam(0.6, 0.05, 4000); [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, { at: i * 0.11, vol: 0.12, type: 'sawtooth' })); },
  flow: () => bubbles(4, 500),
  // Réaction : pétillement montant + souffle
  react: () => { bubbles(12, 600); steam(0.7, 0.05, 5000); tone(220, 0.6, { vol: 0.06, slide: 440, type: 'triangle' }); },
};

export function play(name) {
  const s = load().settings;
  if (!s.sound) return;
  try { SOUNDS[name]?.(); } catch { /* audio indisponible */ }
}

export function buzz(pattern = 20) {
  const s = load().settings;
  if (s.vibrate && navigator.vibrate) navigator.vibrate(pattern);
}
