// Moteur audio : sons enregistrés (Kenney, CC0) + liquides synthétisés physiquement, mixés avec
// compresseur et réverbération. Ambiance de machinerie en boucle. Tout se charge au premier geste.
import { load } from './storage.js';

const SAMPLES = {
  'tap-glass': 'sounds/tap-glass.ogg', 'tap-metal': 'sounds/tap-metal.ogg', ui: 'sounds/ui.ogg',
  'clank-1': 'sounds/clank-1.ogg', 'clank-2': 'sounds/clank-2.ogg', 'clank-3': 'sounds/clank-3.ogg',
  ratchet: 'sounds/ratchet.ogg', thud: 'sounds/thud.ogg', error: 'sounds/error.ogg', glitch: 'sounds/glitch.ogg',
  deliver: 'sounds/deliver.ogg', win: 'sounds/win.ogg', bell: 'sounds/bell.ogg', forcefield: 'sounds/forcefield.ogg',
  steam: 'sounds/steam.ogg', ambient: 'sounds/ambient.ogg',
};

let ctx = null, master = null, sfxBus = null, ambBus = null, reverbSend = null;
const buffers = {};
let loading = null, ambientSrc = null;

const settings = () => load().settings;
const sfxVolume = () => (settings().sound ? (settings().sfxVol ?? 0.8) : 0);
const ambVolume = () => (settings().sound ? (settings().ambVol ?? 0.35) : 0);

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    // Chaîne : bus effets + bus ambiance -> compresseur -> sortie ; envoi réverbération sur les effets
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    master = ctx.createGain(); master.gain.value = 0.9;
    comp.connect(master).connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVolume(); sfxBus.connect(comp);
    ambBus = ctx.createGain(); ambBus.gain.value = 0; ambBus.connect(comp);
    const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 1.6, 2.8);
    reverbSend = ctx.createGain(); reverbSend.gain.value = 0.22;
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.7;
    reverbSend.connect(verb).connect(verbOut).connect(comp);
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Réponse impulsionnelle synthétique : bruit stéréo à décroissance exponentielle (petite salle métallique). */
function impulse(c, seconds, decay) {
  const len = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

// ---------- Synthèse physique des liquides ----------
// Une bulle qui se forme dans l'eau sonne comme une sinusoïde amortie dont la hauteur monte
// (fréquence de Minnaert ≈ 3,3 / rayon). Des dizaines de bulles + un bruit filtré = un vrai glouglou.
function bubble(c, out, t, radiusMm, amp) {
  const f0 = 3260 / radiusMm;
  const dur = 0.012 + radiusMm * 0.012;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * (1.4 + Math.random() * 0.5), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(c, seconds) {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = last * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = last; } // bruit légèrement rosé
  return b;
}

/**
 * Rendu hors-ligne d'un son liquide. kind : pour (verser), fill (robinet), drain (évier), fizz (réaction), flow (tuyaux).
 */
async function renderLiquid(kind, seed) {
  const sr = 44100;
  const P = {
    pour: { dur: 0.75, rate: 46, rMin: 1.2, rMax: 4.5, amp: 0.22, nf: 900, nq: 0.9, ng: 0.16 },
    fill: { dur: 0.6, rate: 60, rMin: 1, rMax: 3.2, amp: 0.18, nf: 1400, nq: 0.7, ng: 0.22 },
    drain: { dur: 0.9, rate: 26, rMin: 2.5, rMax: 7, amp: 0.3, nf: 420, nq: 1.2, ng: 0.2 },
    fizz: { dur: 1.3, rate: 120, rMin: 0.4, rMax: 1.4, amp: 0.1, nf: 5200, nq: 0.6, ng: 0.12 },
    flow: { dur: 0.7, rate: 22, rMin: 1.8, rMax: 5, amp: 0.14, nf: 600, nq: 1, ng: 0.1 },
  }[kind];
  const c = new OfflineAudioContext(1, Math.ceil(sr * (P.dur + 0.3)), sr);
  const bus = c.createGain(); bus.connect(c.destination);
  // Ruissellement : bruit filtré passe-bande, enveloppe qui monte puis retombe, légère ondulation
  const n = c.createBufferSource(); n.buffer = noise(c, P.dur + 0.3);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = P.nf; bp.Q.value = P.nq;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0, 0);
  ng.gain.linearRampToValueAtTime(P.ng, 0.06);
  ng.gain.setValueAtTime(P.ng, P.dur * 0.6);
  ng.gain.exponentialRampToValueAtTime(0.001, P.dur + 0.2);
  const lfo = c.createOscillator(), lfoG = c.createGain();
  lfo.frequency.value = 7 + (seed % 5); lfoG.gain.value = P.nf * 0.25;
  lfo.connect(lfoG).connect(bp.frequency); lfo.start();
  n.connect(bp).connect(ng).connect(bus); n.start();
  // Bulles : densité maximale au milieu du son
  let rnd = seed * 9301 + 49297;
  const rand = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);
  const count = Math.floor(P.rate * P.dur);
  for (let i = 0; i < count; i++) {
    const u = rand();
    const t = 0.02 + P.dur * (kind === 'fizz' ? Math.pow(u, 0.7) : u);
    const r = P.rMin + (P.rMax - P.rMin) * Math.pow(rand(), 1.6);
    const env = Math.sin(Math.PI * Math.min(1, t / P.dur));
    bubble(c, bus, t, r, P.amp * (0.35 + rand() * 0.65) * (0.3 + 0.7 * env));
  }
  return c.startRendering();
}

function loadAll() {
  if (loading) return loading;
  const c = ac();
  if (!c) return Promise.resolve();
  const files = Object.entries(SAMPLES).map(async ([k, url]) => {
    try {
      const res = await fetch(url);
      buffers[k] = await c.decodeAudioData(await res.arrayBuffer());
    } catch { /* son indisponible : on l'ignore */ }
  });
  const synth = [];
  for (const kind of ['pour', 'fill', 'drain', 'fizz', 'flow']) {
    for (let v = 0; v < 3; v++) synth.push(renderLiquid(kind, v + 1).then((b) => { buffers[`${kind}-${v}`] = b; }).catch(() => {}));
  }
  loading = Promise.all([...files, ...synth]).then(() => { prepareAmbient(); startAmbient(); });
  return loading;
}

/** Boucle d'ambiance sans couture : on fond la fin du fichier dans son début. */
function prepareAmbient() {
  const b = buffers.ambient;
  if (!b || b.looped) return;
  const sr = b.sampleRate, fade = Math.floor(sr * 0.8), len = b.length - fade;
  const out = ctx.createBuffer(1, len, sr);
  const src = b.getChannelData(0), dst = out.getChannelData(0);
  for (let i = 0; i < len; i++) dst[i] = src[i];
  for (let i = 0; i < fade; i++) {
    const x = i / fade;
    dst[i] = src[i] * Math.sqrt(x) + src[len + i] * Math.sqrt(1 - x);
  }
  out.looped = true;
  buffers.ambient = out;
}

function startAmbient() {
  if (!ctx || ambientSrc || !buffers.ambient) return;
  ambientSrc = ctx.createBufferSource();
  ambientSrc.buffer = buffers.ambient; ambientSrc.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  ambientSrc.connect(lp).connect(ambBus);
  ambientSrc.start();
  ambBus.gain.setTargetAtTime(ambVolume() * 0.5, ctx.currentTime, 1.2);
}

/** Joue un échantillon. opts : { vol, rate, delay, verb } */
function sample(name, { vol = 1, rate = 1, delay = 0, verb = 0.6, vary = 0.04 } = {}) {
  const b = buffers[name];
  if (!b || !ctx) return;
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * vary);
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(g).connect(sfxBus);
  if (verb) { const v = ctx.createGain(); v.gain.value = verb; g.connect(v).connect(reverbSend); }
  s.start(ctx.currentTime + delay);
}
const pick = (base, n) => `${base}-${Math.floor(Math.random() * n)}`;

const RECIPES = {
  select: () => sample('tap-glass', { vol: 0.55, rate: 1.05, vary: 0.08 }),
  ui: () => sample('ui', { vol: 0.5 }),
  pour: () => { sample(pick('pour', 3), { vol: 1, verb: 0.5, vary: 0.06 }); sample('tap-glass', { vol: 0.25, rate: 0.8, delay: 0.05 }); },
  fill: () => { sample('tap-metal', { vol: 0.35, rate: 0.7 }); sample(pick('fill', 3), { vol: 1, delay: 0.04, verb: 0.5 }); },
  empty: () => { sample('steam', { vol: 0.55, verb: 0.8 }); sample(pick('drain', 3), { vol: 0.9, delay: 0.05 }); },
  place: () => sample(`clank-${1 + Math.floor(Math.random() * 3)}`, { vol: 0.75, vary: 0.08 }),
  rotate: () => sample('ratchet', { vol: 0.55, vary: 0.1 }),
  remove: () => sample('thud', { vol: 0.8 }),
  error: () => { sample('error', { vol: 0.5, verb: 0.2 }); sample('glitch', { vol: 0.45, delay: 0.03, verb: 0 }); },
  deliver: () => { sample('deliver', { vol: 0.75 }); sample('tap-glass', { vol: 0.4, rate: 1.3, delay: 0.02 }); },
  coin: () => sample('bell', { vol: 0.4, rate: 1.25, verb: 0.8 }),
  win: () => { sample('win', { vol: 0.8 }); sample('forcefield', { vol: 0.45, delay: 0.1, verb: 1 }); sample('steam', { vol: 0.35, delay: 0.25, verb: 1 }); },
  flow: () => sample(pick('flow', 3), { vol: 0.7, verb: 0.7 }),
  react: () => { sample(pick('fizz', 3), { vol: 1, verb: 0.6 }); sample('forcefield', { vol: 0.35, rate: 1.2, verb: 0.9 }); sample('steam', { vol: 0.25, delay: 0.45 }); },
};

export function play(name) {
  if (!settings().sound) return;
  try {
    const c = ac();
    if (!c) return;
    loadAll().then(() => RECIPES[name]?.());
  } catch { /* audio indisponible */ }
}

/** Applique les volumes après un changement de réglage. */
export function applyVolumes() {
  if (!ctx) return;
  sfxBus.gain.setTargetAtTime(sfxVolume(), ctx.currentTime, 0.05);
  ambBus.gain.setTargetAtTime(ambVolume() * 0.5, ctx.currentTime, 0.3);
}

/** Déverrouille l'audio au premier geste (exigence des navigateurs mobiles) et lance l'ambiance. */
export function unlockOnFirstGesture() {
  const go = () => {
    window.removeEventListener('pointerdown', go, true);
    if (settings().sound) { ac(); loadAll(); }
  };
  window.addEventListener('pointerdown', go, true);
}

export function buzz(pattern = 20) {
  if (settings().vibrate && navigator.vibrate) navigator.vibrate(pattern);
}

/** Diagnostic (tests) : sons chargés et leur durée. */
export function audioStatus() {
  return Object.fromEntries(Object.entries(buffers).map(([k, b]) => [k, Math.round(b.duration * 100) / 100]));
}
