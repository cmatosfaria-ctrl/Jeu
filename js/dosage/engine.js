// Moteur du Dosage : fioles, sources, évier, commandes. Mélange homogène en fractions exactes.
import { Frac, ZERO } from '../core/fraction.js';
import { toRatio } from '../core/color.js';

const NP = 4; // R, Y, B, W
const zeros = () => [ZERO, ZERO, ZERO, ZERO];

/**
 * Niveau : {
 *   caps: [capacités des fioles],
 *   sources: [{ comp: [r,y,b,w] parts entières, stock: number|null }],
 *   orders: [{ vol, ratio: [r,y,b,w] }],
 * }
 */
export function initialState(level) {
  return {
    flasks: level.caps.map((cap) => ({ cap, vol: 0, amt: zeros() })),
    stock: level.sources.map((s) => (s.stock == null ? -1 : s.stock)),
    done: level.orders.map(() => false),
  };
}

export function cloneState(s) {
  return {
    flasks: s.flasks.map((f) => ({ cap: f.cap, vol: f.vol, amt: f.amt.slice() })),
    stock: s.stock.slice(),
    done: s.done.slice(),
  };
}

export function stateKey(s) {
  let k = '';
  for (const f of s.flasks) {
    k += f.vol;
    if (f.vol) for (const a of f.amt) k += ',' + a.n + '/' + a.d;
    k += '|';
  }
  return k + s.stock.join(',') + '|' + s.done.map((d) => (d ? 1 : 0)).join('');
}

export function flaskRatio(f) { return toRatio(f.amt); }

/** La fiole correspond-elle exactement à la commande (volume et proportions) ? */
export function matches(f, order) {
  if (f.vol !== order.vol) return false;
  const sum = order.ratio.reduce((a, b) => a + b, 0);
  for (let i = 0; i < NP; i++) {
    // amt_i / vol == ratio_i / sum  <=>  amt_i * sum == ratio_i * vol
    const a = f.amt[i];
    if (a.n * sum !== order.ratio[i] * f.vol * a.d) return false;
  }
  return true;
}

export function sourceFracs(src) {
  const sum = src.comp.reduce((a, b) => a + b, 0);
  return src.comp.map((c) => new Frac(c, sum));
}

/** Liste des coups légaux. t: fill | pour | empty | deliver */
export function legalMoves(level, s) {
  const moves = [];
  const F = s.flasks;
  for (let o = 0; o < level.orders.length; o++) {
    if (s.done[o]) continue;
    for (let f = 0; f < F.length; f++) if (matches(F[f], level.orders[o])) moves.push({ t: 'deliver', f, o });
  }
  for (let f = 0; f < F.length; f++) {
    const fl = F[f];
    if (fl.vol < fl.cap) {
      for (let si = 0; si < level.sources.length; si++) if (s.stock[si] !== 0) moves.push({ t: 'fill', s: si, f });
    }
    if (fl.vol > 0) {
      for (let g = 0; g < F.length; g++) if (g !== f && F[g].vol < F[g].cap) moves.push({ t: 'pour', a: f, b: g });
      moves.push({ t: 'empty', f });
    }
  }
  return moves;
}

/** Vérifie la légalité d'un coup (pour l'interface). Renvoie un message d'erreur ou null. */
export function checkMove(level, s, m) {
  const F = s.flasks;
  switch (m.t) {
    case 'fill':
      if (F[m.f].vol >= F[m.f].cap) return 'Cette fiole est déjà pleine.';
      if (s.stock[m.s] === 0) return 'Cette source est épuisée.';
      return null;
    case 'pour':
      if (m.a === m.b) return null;
      if (F[m.a].vol === 0) return 'La fiole est vide.';
      if (F[m.b].vol >= F[m.b].cap) return 'La fiole de destination est pleine.';
      return null;
    case 'empty':
      return F[m.f].vol === 0 ? 'La fiole est déjà vide.' : null;
    case 'deliver':
      if (s.done[m.o]) return 'Commande déjà livrée.';
      if (!matches(F[m.f], level.orders[m.o])) {
        const o = level.orders[m.o];
        if (F[m.f].vol !== o.vol) return `Il faut exactement ${o.vol} dose${o.vol > 1 ? 's' : ''}.`;
        return 'Les proportions ne correspondent pas.';
      }
      return null;
  }
  return 'Coup inconnu';
}

/** Applique un coup (sans vérification) et renvoie le nouvel état + infos (doses puisées). */
export function applyMove(level, s, m, srcFracs) {
  const n = cloneState(s);
  const F = n.flasks;
  let drawn = 0, moved = 0;
  if (m.t === 'fill') {
    const fl = F[m.f];
    let q = fl.cap - fl.vol;
    if (n.stock[m.s] >= 0) { q = Math.min(q, n.stock[m.s]); n.stock[m.s] -= q; }
    const sf = srcFracs ? srcFracs[m.s] : sourceFracs(level.sources[m.s]);
    fl.amt = fl.amt.map((a, i) => (sf[i].n ? a.add(sf[i].mul(q)) : a));
    fl.vol += q;
    drawn = q; moved = q;
  } else if (m.t === 'pour') {
    const A = F[m.a], B = F[m.b];
    const q = Math.min(A.vol, B.cap - B.vol);
    if (q === A.vol) {
      B.amt = B.amt.map((b, i) => (A.amt[i].n ? b.add(A.amt[i]) : b));
      A.amt = zeros();
    } else {
      for (let i = 0; i < NP; i++) {
        if (!A.amt[i].n) continue;
        const part = A.amt[i].mul(q).div(A.vol);
        B.amt[i] = B.amt[i].add(part);
        A.amt[i] = A.amt[i].sub(part);
      }
    }
    A.vol -= q; B.vol += q; moved = q;
  } else if (m.t === 'empty') {
    moved = F[m.f].vol;
    F[m.f].vol = 0; F[m.f].amt = zeros();
  } else if (m.t === 'deliver') {
    n.done[m.o] = true;
    moved = F[m.f].vol;
    F[m.f].vol = 0; F[m.f].amt = zeros();
  }
  return { state: n, drawn, moved };
}

export const isWon = (s) => s.done.every(Boolean);
export const moveCost = (m) => (m.t === 'deliver' ? 0 : 1);

export function starsFor(moves, par, hintUsed = false) {
  let st = moves <= par ? 3 : moves <= Math.ceil(par * 1.5) ? 2 : 1;
  if (hintUsed) st = Math.min(st, 2);
  return st;
}
