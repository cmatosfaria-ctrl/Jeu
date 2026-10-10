// Simulation des flux : propagation depuis les sources, séparations, mélanges, fuites, collisions.
import { Frac, ZERO } from '../core/fraction.js';
import { toRatio } from '../core/color.js';
import { DX, DY, opposite, route } from './pieces.js';

const HALF = new Frac(1, 2);
const addV = (a, b) => a.map((x, i) => x.add(b[i]));
const mulV = (a, k) => a.map((x) => x.mul(k));
const total = (v) => v.reduce((s, x) => s.add(x), ZERO);

/**
 * board : { w, h, cells: Array(w*h) } ; cellule = null | { kind, ... }
 *  kind 'src'  : { color:[r,y,b,w], dir }
 *  kind 'tank' : { dir, target:[r,y,b,w]|null }
 *  kind 'drain' | 'rock'
 *  kind 'pipe' : { type, r, fixed? }
 * Renvoie { errors, tanks: Map(idx -> amounts), segments: [{idx, side, amounts}], solved }
 */
export function simulate(board) {
  const { w, h, cells } = board;
  const errors = [];
  const segments = []; // flux qui traversent un côté d'une case (pour colorer)
  const tanks = new Map();
  const tankT = new Map(); // instant d'arrivée du liquide dans chaque cuve
  const drains = new Map();
  const used = new Map(); // idx -> Set(clé de paire/entrée) pour détecter les collisions
  const mixers = new Map(); // idx -> { got: Map(side -> amounts), info }
  const queue = [];
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

  // Émettre depuis la case idx par le côté d
  // t : instant (en demi-cases parcourues) où le liquide entre dans ce segment — sert à l'animation.
  function emit(idx, d, amounts, t = 0) {
    const x = idx % w, y = (idx / w) | 0;
    segments.push({ idx, side: d, amounts, out: true, t });
    const nx = x + DX[d], ny = y + DY[d];
    if (!inside(nx, ny)) { errors.push({ idx, side: d, kind: 'fuite' }); return; }
    const nidx = ny * w + nx;
    const c = cells[nidx];
    const entry = opposite(d);
    if (!c || c.kind === 'rock') { errors.push({ idx, side: d, kind: 'fuite' }); return; }
    queue.push({ idx: nidx, side: entry, amounts, t: t + 1 });
  }

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c && c.kind === 'src') emit(i, c.dir, c.color.map((v) => new Frac(v ? 1 : 0)));
  }

  let guard = 0;
  while (queue.length || [...mixers.values()].some((m) => !m.done && m.got.size === m.info.ins.length)) {
    if (++guard > 5000) { errors.push({ idx: 0, kind: 'boucle' }); break; }
    if (!queue.length) {
      for (const [idx, m] of mixers) {
        if (!m.done && m.got.size === m.info.ins.length) {
          m.done = true;
          const sum = [...m.got.values()].reduce((a, b) => addV(a, b));
          for (const o of m.info.outs) emit(idx, o, sum, m.t + 1);
        }
      }
      continue;
    }
    const { idx, side, amounts, t } = queue.shift();
    const c = cells[idx];
    segments.push({ idx, side, amounts, out: false, t });
    if (c.kind === 'tank') {
      if (side !== c.dir) { errors.push({ idx, side, kind: 'fuite' }); continue; }
      tanks.set(idx, tanks.has(idx) ? addV(tanks.get(idx), amounts) : amounts);
      tankT.set(idx, Math.max(tankT.get(idx) || 0, t + 1));
      continue;
    }
    if (c.kind === 'drain') { drains.set(idx, drains.has(idx) ? addV(drains.get(idx), amounts) : amounts); continue; }
    if (c.kind === 'src') { errors.push({ idx, side, kind: 'collision' }); continue; }
    const rt = route(c.type, c.r, side);
    if (!rt) { errors.push({ idx, side, kind: 'fuite' }); continue; }
    if (rt.mix) {
      let m = mixers.get(idx);
      if (!m) mixers.set(idx, (m = { got: new Map(), info: rt, done: false }));
      if (m.got.has(side) || m.done) { errors.push({ idx, side, kind: 'collision' }); continue; }
      m.got.set(side, amounts);
      m.t = Math.max(m.t || 0, t);
      continue;
    }
    // Un tuyau (ou une paire du croisement) ne peut porter qu'un seul flux.
    const key = rt.split ? 'S' : Math.min(side, rt.outs[0]) + '-' + Math.max(side, rt.outs[0]);
    const set = used.get(idx) || new Set();
    if (set.has(key)) { errors.push({ idx, side, kind: 'collision' }); continue; }
    set.add(key); used.set(idx, set);
    if (rt.split) for (const o of rt.outs) emit(idx, o, mulV(amounts, HALF), t + 1);
    else emit(idx, rt.outs[0], amounts, t + 1);
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
