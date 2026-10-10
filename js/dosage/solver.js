// Solveur BFS 0-1 : nombre minimal de coups (les livraisons sont gratuites) + chemin optimal.
import { toRatio } from '../core/color.js';
import { legalMoves, applyMove, stateKey, isWon, moveCost, sourceFracs } from './engine.js';

const MAX_DEN = 1e7;

function sane(s) {
  for (const f of s.flasks) for (const a of f.amt) if (a.d > MAX_DEN || Math.abs(a.n) > MAX_DEN) return false;
  return true;
}

/**
 * @returns {{ cost:number, path:Array }|null}  null si non résolu dans la limite.
 */
export function solve(level, start, { maxNodes = 250000 } = {}) {
  const srcFracs = level.sources.map(sourceFracs);
  const startKey = stateKey(start);
  const dist = new Map([[startKey, 0]]);
  const parent = new Map([[startKey, null]]);
  // Deque à deux piles : front (coût 0) et file principale
  let front = [], cur = [{ s: start, k: startKey, d: 0 }], next = [];
  let expanded = 0;
  while (front.length || cur.length || next.length) {
    let node;
    if (front.length) node = front.pop();
    else if (cur.length) node = cur.pop();
    else { cur = next.reverse(); next = []; continue; }
    if (dist.get(node.k) < node.d) continue;
    if (isWon(node.s)) {
      const path = [];
      let k = node.k;
      while (parent.get(k)) { const p = parent.get(k); path.push(p.m); k = p.k; }
      return { cost: node.d, path: path.reverse() };
    }
    if (++expanded > maxNodes) return null;
    const ms = legalMoves(level, node.s);
    for (const m of ms) {
      const { state } = applyMove(level, node.s, m, srcFracs);
      if (!sane(state)) continue;
      const k = stateKey(state);
      const nd = node.d + moveCost(m);
      const old = dist.get(k);
      if (old !== undefined && old <= nd) continue;
      dist.set(k, nd);
      parent.set(k, { k: node.k, m });
      (moveCost(m) === 0 ? front : next).push({ s: state, k, d: nd });
    }
  }
  return null;
}

/**
 * Explore les états atteignables (sans commandes) jusqu'à une profondeur donnée et
 * renvoie chaque « produit » (volume + proportion) avec la profondeur minimale pour l'obtenir.
 */
export function exploreProducts(level, start, { maxDepth = 12, maxNodes = 200000 } = {}) {
  const srcFracs = level.sources.map(sourceFracs);
  const lv = { ...level, orders: [] };
  const seen = new Set([stateKey(start)]);
  const products = new Map();
  let layer = [start], depth = 0, count = 0;
  while (layer.length && depth < maxDepth) {
    depth++;
    const nextLayer = [];
    for (const s of layer) {
      for (const m of legalMoves(lv, s)) {
        const { state } = applyMove(lv, s, m, srcFracs);
        if (!sane(state)) continue;
        const k = stateKey(state);
        if (seen.has(k)) continue;
        seen.add(k);
        if (++count > maxNodes) return products;
        nextLayer.push(state);
        for (const f of state.flasks) {
          if (!f.vol) continue;
          const pk = f.vol + '#' + ratioOf(f);
          if (!products.has(pk)) products.set(pk, { vol: f.vol, ratio: ratioArr(f), depth });
        }
      }
    }
    layer = nextLayer;
  }
  return products;
}

const ratioArr = (f) => toRatio(f.amt);
const ratioOf = (f) => ratioArr(f).join(':');
