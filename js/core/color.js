// Système de couleurs commun : primaires Rouge, Jaune, Bleu, Blanc et mélange « peintre ».
import { gcd, lcm } from './fraction.js';

export const PRIMARIES = ['R', 'Y', 'B', 'W'];
export const PRIMARY_INFO = {
  R: { name: 'Rouge', short: 'R', css: '#e0283c' },
  Y: { name: 'Jaune', short: 'J', css: '#ffd21f' },
  B: { name: 'Bleu', short: 'B', css: '#2a62d8' },
  W: { name: 'Blanc', short: 'Bl', css: '#f4f1ea' },
};
export const pIndex = (p) => PRIMARIES.indexOf(p);

// Coins du cube RYB (Gossett & Chen) -> RGB
const CORNERS = [
  [1, 1, 1],          // 000 blanc
  [0.16, 0.37, 0.6],  // 001 bleu
  [1, 1, 0],          // 010 jaune
  [0, 0.66, 0.2],     // 011 vert
  [1, 0, 0],          // 100 rouge
  [0.5, 0, 0.5],      // 101 violet
  [1, 0.5, 0],        // 110 orange
  [0.2, 0.094, 0],    // 111 brun
];

function ryb2rgb(r, y, b) {
  const out = [0, 0, 0];
  for (let i = 0; i < 8; i++) {
    const wr = i & 4 ? r : 1 - r;
    const wy = i & 2 ? y : 1 - y;
    const wb = i & 1 ? b : 1 - b;
    const w = wr * wy * wb;
    for (let c = 0; c < 3; c++) out[c] += w * CORNERS[i][c];
  }
  return out;
}

/** Couleur CSS d'un mélange donné par ses quantités [R, Y, B, W] (nombres ou fractions). */
export function mixColor(amounts) {
  const a = amounts.map(Number);
  const total = a[0] + a[1] + a[2] + a[3];
  if (total <= 0) return 'transparent';
  const m = Math.max(a[0], a[1], a[2]);
  let rgb;
  if (m <= 0) rgb = [0.96, 0.95, 0.92];
  else {
    rgb = ryb2rgb(a[0] / m, a[1] / m, a[2] / m);
    // Les pigments faibles se diluent légèrement : un rouge 3:1 n'a pas la même teinte qu'un 1:1.
  }
  const w = (a[3] / total) * 0.85;
  rgb = rgb.map((v) => v * (1 - w) + 0.97 * w);
  const hex = rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
  return `#${hex}`;
}

/** Ramène des quantités (fractions ou entiers) à des parts entières réduites. */
export function toRatio(amounts) {
  const fr = amounts.map((x) => (typeof x === 'number' ? { n: x, d: 1 } : x));
  let L = 1;
  for (const f of fr) if (f.n) L = lcm(L, f.d);
  const ints = fr.map((f) => (f.n ? (f.n * L) / f.d : 0));
  let g = 0;
  for (const v of ints) g = gcd(g, v);
  return g ? ints.map((v) => v / g) : ints;
}

export function ratioKey(ratio) { return ratio.join(':'); }

/** Nom poétique approximatif d'un mélange, pour l'interface. */
export function mixName(ratio) {
  const [r, y, b, w] = ratio;
  const present = [r, y, b].filter((v) => v > 0).length;
  let base;
  if (present === 0) base = w ? 'Blanc' : '—';
  else if (present === 3) {
    // Une couleur dominante (≥ 50 %) donne une teinte « rompue » plutôt qu'un brun neutre.
    const t = r + y + b;
    base = r * 2 >= t ? 'Brique' : y * 2 >= t ? 'Olive' : b * 2 >= t ? 'Ardoise' : 'Brun';
  }
  else if (present === 1) base = r ? 'Rouge' : y ? 'Jaune' : 'Bleu';
  else if (r && y) base = r > y ? 'Vermillon' : r < y ? 'Ambre' : 'Orange';
  else if (r && b) base = r > b ? 'Pourpre' : r < b ? 'Indigo' : 'Violet';
  else base = y > b ? 'Chartreuse' : y < b ? 'Sarcelle' : 'Vert';
  if (w && present) base += w >= r + y + b ? ' pastel' : ' clair';
  return base;
}

export function ratioParts(ratio) {
  return PRIMARIES.map((p, i) => ({ p, k: ratio[i], ...PRIMARY_INFO[p] })).filter((x) => x.k > 0);
}
