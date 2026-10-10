// Simulation des flux : propagation depuis les sources, séparations, mélanges, vannes, pression,
// fuites et collisions. Fractions exactes.
import { Frac, ZERO, ONE } from '../core/fraction.js';
import { toRatio } from '../core/color.js';
import { DX, DY, opposite, route, capacity, onValveAxis, PIECES } from './pieces.js';

const HALF = new Frac(1, 2);
const addV = (a, b) => a.map((x, i) => x.add(b[i]));
const mulV = (a, k) => a.map((x) => x.mul(k));
const total = (v) => v.reduce((s, x) => s.add(x), ZERO);

/**
 * board : { w, h, cells: Array(w*h), pressure? } ; cellule = null | { kind, ... }
 *  kind 'src'   : { color:[r,y,b,w], dir }
 *  kind 'tank'  : { dir, target:[r,y,b,w]|null }
 *  kind 'drain' | 'rock'
 *  kind 'pipe'  : { type, r, fixed? }
 *  kind 'valve' : { axis: 0|1, open: bool }
 * Renvoie { errors, tanks, segments: [{ idx, side, amounts, out, t }], drains, solved }
 */
export function simulate(board) {
  const { w, h, cells, pressure = false } = board;
  const errors = [];
  const segments = [];
  const tanks = new Map();
  const tankT = new Map();
  const drains = new Map();
  const used = new Map();
  const mixers = new Map();
  const queue = [];
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const neighbor = (idx, d) => {
    const nx = (idx % w) + DX[d], ny = ((idx / w) | 0) + DY[d];
    return inside(nx, ny) ? ny * w + nx : -1;
  };

  // --- Analyse statique du réseau (pour les vannes) ---
  // Un flux émis par (idx, d) peut-il aller quelque part ? Non seulement si TOUTES ses routes butent sur une vanne fermée.
  const viableMemo = new Map();
  function viable(idx, d, stack = new Set()) {
    const n = neighbor(idx, d);
    if (n < 0) return true;
    const c = cells[n];
    if (!c || (c.kind !== 'pipe' && c.kind !== 'valve')) return true;
    const entry = opposite(d), key = n * 4 + entry;
    if (viableMemo.has(key)) return viableMemo.get(key);
    if (stack.has(key)) return true;
    stack.add(key);
    let res = true;
    if (c.kind === 'valve') res = !onValveAxis(c, entry) || (c.open && viable(n, opposite(entry), stack));
    else {
      const rt = route(c.type, c.r, entry);
      if (rt) res = rt.split ? rt.outs.some((o) => viable(n, o, stack)) : viable(n, rt.outs[0], stack);
    }
    stack.delete(key);
    viableMemo.set(key, res);
    return res;
  }
  // L'entrée d'une case par le côté `side` est-elle coupée en amont par une vanne fermée ?
  function upstreamBlocked(idx, side, stack = new Set()) {
    const n = neighbor(idx, side);
    if (n < 0) return false;
    const c = cells[n];
    if (!c) return false;
    const exit = opposite(side), key = n * 4 + exit;
    if (stack.has(key)) return false;
    stack.add(key);
    if (c.kind === 'valve') return onValveAxis(c, exit) && (!c.open || upstreamBlocked(n, opposite(exit), stack));
    if (c.kind !== 'pipe') return false;
    const P = PIECES[c.type];
    if (P.pairs) {
      for (const [a, b] of P.pairs) {
        const ra = (a + c.r) % 4, rb = (b + c.r) % 4;
        if (exit === ra) return upstreamBlocked(n, rb, stack);
        if (exit === rb) return upstreamBlocked(n, ra, stack);
      }
      return false;
    }
    const rt = route(c.type, c.r, (P.ins[0] + c.r) % 4);
    if (!rt.outs.includes(exit)) return false;
    return rt.ins.every((i) => upstreamBlocked(n, i, stack));
  }

  // Émettre depuis la case idx par le côté d. t : instant (en demi-cases) d'entrée du liquide — pour l'animation.
  function emit(idx, d, amounts, t = 0) {
    segments.push({ idx, side: d, amounts, out: true, t });
    const n = neighbor(idx, d);
    const c = n >= 0 ? cells[n] : null;
    if (!c || c.kind === 'rock') { errors.push({ idx, side: d, kind: 'fuite' }); return; }
    queue.push({ idx: n, side: opposite(d), amounts, t: t + 1 });
  }

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c && c.kind === 'src') emit(i, c.dir, c.color.map((v) => new Frac(v ? 1 : 0)));
  }

  const pendingMixers = () => [...mixers.entries()].filter(([, m]) => !m.done);
  let guard = 0;
  for (;;) {
    if (++guard > 8000) { errors.push({ idx: 0, kind: 'boucle' }); break; }
    if (!queue.length) {
      // Mélangeurs prêts : toutes les entrées reçues, ou les manquantes coupées par une vanne fermée.
      let released = false;
      for (const [idx, m] of pendingMixers()) {
        const missing = m.info.ins.filter((s) => !m.got.has(s));
        if (missing.length && !missing.every((s) => upstreamBlocked(idx, s))) continue;
        m.done = true; released = true;
        const sum = [...m.got.values()].reduce((a, b) => addV(a, b));
        for (const o of m.info.outs) emit(idx, o, sum, m.t + 1);
      }
      if (!released) break;
      continue;
    }
    const { idx, side, amounts, t } = queue.shift();
    const c = cells[idx];
    segments.push({ idx, side, amounts, out: false, t });
    if (pressure && total(amounts) > capacity(c)) errors.push({ idx, side, kind: 'rupture' });
    if (c.kind === 'tank') {
      if (side !== c.dir) { errors.push({ idx, side, kind: 'fuite' }); continue; }
      tanks.set(idx, tanks.has(idx) ? addV(tanks.get(idx), amounts) : amounts);
      tankT.set(idx, Math.max(tankT.get(idx) || 0, t + 1));
      continue;
    }
    if (c.kind === 'drain') { drains.set(idx, drains.has(idx) ? addV(drains.get(idx), amounts) : amounts); continue; }
    if (c.kind === 'src') { errors.push({ idx, side, kind: 'collision' }); continue; }
    if (c.kind === 'valve') {
      if (!onValveAxis(c, side)) { errors.push({ idx, side, kind: 'fuite' }); continue; }
      if (!c.open) { errors.push({ idx, side, kind: 'bloqué' }); continue; }
      if (used.has(idx)) { errors.push({ idx, side, kind: 'collision' }); continue; }
      used.set(idx, new Set(['v']));
      emit(idx, opposite(side), amounts, t + 1);
      continue;
    }
    const rt = route(c.type, c.r, side);
    if (!rt) { errors.push({ idx, side, kind: 'fuite' }); continue; }
    if (rt.mix) {
      let m = mixers.get(idx);
      if (!m) mixers.set(idx, (m = { got: new Map(), info: rt, done: false, t: 0 }));
      if (m.got.has(side) || m.done) { errors.push({ idx, side, kind: 'collision' }); continue; }
      m.got.set(side, amounts);
      m.t = Math.max(m.t, t);
      continue;
    }
    const key = rt.split ? 'S' : Math.min(side, rt.outs[0]) + '-' + Math.max(side, rt.outs[0]);
    const set = used.get(idx) || new Set();
    if (set.has(key)) { errors.push({ idx, side, kind: 'collision' }); continue; }
    set.add(key); used.set(idx, set);
    if (rt.split) {
      // Une sortie coupée par une vanne : tout le débit part dans l'autre.
      const ok = rt.outs.filter((o) => viable(idx, o));
      const targets = ok.length ? ok : rt.outs;
      const share = targets.length === 2 ? HALF : ONE;
      for (const o of targets) emit(idx, o, mulV(amounts, share), t + 1);
    } else emit(idx, rt.outs[0], amounts, t + 1);
  }
  for (const [idx, m] of mixers) if (!m.done) errors.push({ idx, kind: 'mélangeur' });

  const tankList = [];
  let solved = errors.length === 0;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c || c.kind !== 'tank') continue;
    const got = tanks.get(i) || null;
    const ratio = got ? toRatio(got) : null;
    const ok = !!got && !!c.target && ratio.join() === c.target.join();
    if (!ok) solved = false;
    tankList.push({ idx: i, amounts: got, ratio, ok, flow: got ? total(got) : ZERO, t: tankT.get(i) || 0 });
  }
  return { errors, tanks: tankList, segments, drains, solved };
}
