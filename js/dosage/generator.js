// Générateur de niveaux de Dosage : explore les produits atteignables puis vérifie au solveur.
import { Rng } from '../core/rng.js';
import { initialState, applyMove } from './engine.js';
import { solve, exploreProducts } from './solver.js';

const PURE = { R: [1, 0, 0, 0], Y: [0, 1, 0, 0], B: [0, 0, 1, 0], W: [0, 0, 0, 1] };
export const pureComp = (p) => PURE[p].slice();

function simpleRatio(r, maxPart) {
  return r.every((v) => v <= maxPart) && r.reduce((a, b) => a + b, 0) <= maxPart + 3;
}
const nColors = (r) => r.filter((v) => v > 0).length;

/**
 * cfg : {
 *   seed, sources: [{comp, stock?}], capsChoices: [[..], ..], orders: 1..3,
 *   par: [min, max], minColors: 1..3, maxPart: 4, maxNodes
 * }
 * Renvoie { caps, sources, orders, par } ou null.
 */
export function generateDosage(cfg) {
  const rng = new Rng(cfg.seed);
  const tries = cfg.tries ?? 30;
  for (let t = 0; t < tries; t++) {
    const caps = rng.pick(cfg.capsChoices).slice();
    const sources = cfg.sources.map((s) => ({ ...s, comp: s.comp.slice() }));
    if (cfg.stockRange) {
      // Une source (au hasard) devient rationnée : il faudra économiser.
      const k = rng.int(0, sources.length - 1);
      sources[k].stock = rng.int(cfg.stockRange[0], cfg.stockRange[1]);
    }
    const base = { caps, sources, orders: [], reactions: cfg.reactions };
    const products = [...exploreProducts(base, initialState(base), {
      maxDepth: cfg.par[1], maxNodes: cfg.exploreNodes ?? 60000,
    }).values()].filter((p) => p.vol >= (cfg.minVol ?? 2) && simpleRatio(p.ratio, cfg.maxPart ?? 4)
      && nColors(p.ratio) >= (cfg.minColors ?? 1));
    if (!products.length) continue;
    const nOrders = cfg.orders ?? 1;
    // Produits « profonds » en priorité : ce sont eux qui demandent de la réflexion.
    const lo = nOrders === 1 ? cfg.par[0] : Math.max(1, Math.floor(cfg.par[0] / nOrders));
    const pool = products.filter((p) => p.depth >= lo);
    if (pool.length < nOrders) continue;
    for (let k = 0; k < 6; k++) {
      const picked = [];
      const shuffled = rng.shuffle(pool);
      for (const p of shuffled) {
        if (picked.some((q) => q.ratio.join() === p.ratio.join())) continue;
        picked.push(p);
        if (picked.length === nOrders) break;
      }
      if (picked.length < nOrders) break;
      const lv = { caps, sources, orders: picked.map((p) => ({ vol: p.vol, ratio: p.ratio })) };
      if (cfg.reactions) lv.reactions = cfg.reactions;
      const res = solve(lv, initialState(lv), { maxNodes: cfg.maxNodes ?? 150000 });
      if (res && cfg.reactions && !reactionsMatter(lv, res, cfg.maxNodes ?? 150000)) continue;
      if (res && res.cost >= cfg.par[0] && res.cost <= cfg.par[1]) {
        return { ...lv, par: res.cost, solution: res.path };
      }
    }
  }
  return null;
}

/**
 * Les réactions changent-elles vraiment la partie ? Oui si la solution optimale en déclenche une,
 * ou si la solution « naïve » (calculée sans réactions) échoue ou coûte plus cher une fois les réactions actives.
 */
export function reactionsMatter(lv, res, maxNodes) {
  let s = initialState(lv), fired = 0;
  for (const m of res.path) { const r = applyMove(lv, s, m); fired += r.reactions.length; s = r.state; }
  if (fired) return true;
  const plain = { ...lv, reactions: undefined };
  const naive = solve(plain, initialState(plain), { maxNodes });
  if (!naive) return true;
  if (naive.cost < res.cost) return true;
  // La solution naïve rejouée avec réactions : déclenche-t-elle un piège ?
  let t = initialState(lv);
  for (const m of naive.path) { const r = applyMove(lv, t, m); if (r.reactions.length) return true; t = r.state; }
  return false;
}
