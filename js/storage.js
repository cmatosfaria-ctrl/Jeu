// Sauvegarde locale (progression, carrière, réglages). Tolérante aux navigateurs sans stockage.
const KEY = 'alchimie-atelier-v1';
let cache = null;

const defaults = () => ({
  settings: { sound: true, vibrate: true, sfxVol: 0.8, ambVol: 0.35 },
  stars: {},      // id de niveau -> meilleures étoiles
  daily: {},      // date -> étoiles
  career: null,
  seenTips: {},
});

export function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : {};
    cache = { ...defaults(), ...saved, settings: { ...defaults().settings, ...(saved.settings || {}) } };
  } catch {
    cache = defaults();
  }
  return cache;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* stockage indisponible */ }
}

export function recordStars(id, stars) {
  const d = load();
  if ((d.stars[id] || 0) < stars) { d.stars[id] = stars; save(); }
}

export function resetAll() {
  cache = defaults();
  save();
}
