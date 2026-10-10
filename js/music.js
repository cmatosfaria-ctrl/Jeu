// Musique adaptative générée en direct : ré mineur, 92 BPM, cinq couches qui entrent selon l'intensité.
//   0 nappe (toujours) · 1 basse pulsée · 2 pistons (percussions mécaniques) · 3 arpège néon · 4 mélodie aiguë
import { musicGraph, musVolume, onVolumeChange } from './audio.js';

const BPM = 92;
const STEP = 60 / BPM / 4; // double-croche
// Progression (2 mesures par accord) : Rém – Si♭ – Fa – Do — notes en demi-tons MIDI
const CHORDS = [
  { root: 38, notes: [62, 65, 69] },  // Dm
  { root: 34, notes: [58, 62, 65] },  // Bb
  { root: 41, notes: [60, 65, 69] },  // F
  { root: 36, notes: [60, 64, 67] },  // C
];
const MELODY = [74, null, 72, null, 69, null, 72, 74, 77, null, 76, 74, 72, null, 69, null]; // motif de 16 pas
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const LAYER_AT = [0, 0.25, 0.42, 0.62, 0.82];

let g = null, layers = [], timer = null, step = 0, nextTime = 0, intensity = 0.2, target = 0.2, delay = null;

function setup() {
  g = musicGraph();
  if (!g) return false;
  const { ctx, bus } = g;
  layers = LAYER_AT.map(() => { const n = ctx.createGain(); n.gain.value = 0; n.connect(bus); return n; });
  // Écho synchronisé (3 double-croches) pour l'arpège et la mélodie
  delay = ctx.createDelay(1);
  delay.delayTime.value = STEP * 3;
  const fb = ctx.createGain(); fb.gain.value = 0.35;
  const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400;
  delay.connect(dl).connect(fb).connect(delay);
  dl.connect(bus);
  return true;
}

function voice({ type = 'sawtooth', f, t, dur, vol, out, cutoff = 1800, q = 1, attack = 0.01, release = 0.12, detune = 0, sendDelay = 0 }) {
  const { ctx } = g;
  const o = ctx.createOscillator(), flt = ctx.createBiquadFilter(), a = ctx.createGain();
  o.type = type; o.frequency.value = f; o.detune.value = detune;
  flt.type = 'lowpass'; flt.frequency.value = cutoff; flt.Q.value = q;
  a.gain.setValueAtTime(0, t);
  a.gain.linearRampToValueAtTime(vol, t + attack);
  a.gain.setTargetAtTime(0, t + dur, release / 3);
  o.connect(flt).connect(a).connect(out);
  if (sendDelay) { const s = ctx.createGain(); s.gain.value = sendDelay; a.connect(s).connect(delay); }
  o.start(t); o.stop(t + dur + release * 2);
}

function noiseHit(t, { vol, hp = 6000, dur = 0.05, out }) {
  const { ctx } = g;
  const len = Math.floor(ctx.sampleRate * dur);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const s = ctx.createBufferSource(); s.buffer = b;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const a = ctx.createGain(); a.gain.value = vol;
  s.connect(f).connect(a).connect(out);
  s.start(t);
}

function kick(t, out) {
  const { ctx } = g;
  const o = ctx.createOscillator(), a = ctx.createGain();
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  a.gain.setValueAtTime(0.9, t);
  a.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  o.connect(a).connect(out);
  o.start(t); o.stop(t + 0.35);
}

function schedule(t, s) {
  const bar = Math.floor(s / 16), pos = s % 16;
  const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
  // 0 — nappe : accord tenu, deux oscillateurs désaccordés, filtre doux
  if (pos === 0 && bar % 2 === 0) {
    for (const n of chord.notes) {
      voice({ f: hz(n - 12), t, dur: STEP * 30, vol: 0.05, out: layers[0], cutoff: 900, attack: 0.8, release: 1.2, detune: -7 });
      voice({ type: 'triangle', f: hz(n), t, dur: STEP * 30, vol: 0.035, out: layers[0], cutoff: 1400, attack: 1, release: 1.2, detune: 6 });
    }
  }
  // 1 — basse pulsée en croches, accent sur les temps
  if (pos % 2 === 0) {
    const n = chord.root + (pos === 14 ? 7 : 0);
    voice({ f: hz(n), t, dur: STEP * 1.6, vol: pos % 4 === 0 ? 0.16 : 0.1, out: layers[1], cutoff: 600 + (pos % 4 === 0 ? 500 : 0), q: 6, release: 0.08 });
  }
  // 2 — pistons : grosse caisse 1 et 3, souffle de vapeur à contretemps, cliquetis métallique
  if (pos === 0 || pos === 8 || (pos === 11 && bar % 2)) kick(t, layers[2]);
  if (pos % 4 === 2) noiseHit(t, { vol: 0.12, hp: 7000, dur: 0.04, out: layers[2] });
  if (pos === 6 || pos === 14) noiseHit(t, { vol: 0.08, hp: 2500, dur: 0.12, out: layers[2] });
  // 3 — arpège néon en double-croches avec écho
  {
    const seq = [...chord.notes, chord.notes[1] + 12];
    const n = seq[pos % seq.length] + (pos >= 8 ? 12 : 0);
    voice({ type: 'square', f: hz(n), t, dur: STEP * 0.7, vol: 0.035, out: layers[3], cutoff: 2600, release: 0.05, sendDelay: 0.5 });
  }
  // 4 — mélodie aiguë + caisse claire 2 et 4
  const m = MELODY[pos];
  if (m && bar % 4 >= 2) voice({ type: 'sawtooth', f: hz(m), t, dur: STEP * 1.8, vol: 0.05, out: layers[4], cutoff: 3200, attack: 0.02, release: 0.25, sendDelay: 0.6, detune: 4 });
  if (pos === 4 || pos === 12) noiseHit(t, { vol: 0.16, hp: 1800, dur: 0.14, out: layers[4] });
}

function loop() {
  const { ctx } = g;
  // Intensité lissée et gains des couches
  intensity += (target - intensity) * 0.08;
  layers.forEach((l, i) => {
    const on = i === 0 ? 1 : Math.max(0, Math.min(1, (intensity - LAYER_AT[i]) / 0.12 + 0.5));
    l.gain.setTargetAtTime(on, ctx.currentTime, 0.6);
  });
  while (nextTime < ctx.currentTime + 0.12) {
    schedule(nextTime, step++);
    nextTime += STEP;
  }
}

function start() {
  if (timer || musVolume() <= 0) return;
  if (!g && !setup()) return;
  nextTime = g.ctx.currentTime + 0.1;
  timer = setInterval(loop, 25);
}
function stop() { clearInterval(timer); timer = null; }

/** Intensité souhaitée (0 calme … 1 tension maximale). */
export function setMusicIntensity(x) {
  target = Math.max(0, Math.min(1, x));
}

/** Petite fanfare de victoire par-dessus la musique. */
export function musicStinger() {
  if (!g || !timer) return;
  const t = g.ctx.currentTime + 0.05;
  [74, 77, 81, 86].forEach((n, i) => voice({ type: 'square', f: hz(n), t: t + i * STEP, dur: STEP * 2, vol: 0.06, out: g.bus, cutoff: 3500, sendDelay: 0.5 }));
  target = 1;
  setTimeout(() => { target = 0.3; }, 4000);
}

onVolumeChange(() => { if (musVolume() > 0) start(); else stop(); });
