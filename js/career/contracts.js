// Contrats : génération quotidienne (déterministe) et construction de l'énigme correspondante.
import { Rng } from '../core/rng.js';
import { PIPE_LEVELS } from '../pipes/levels.js';
import { buildPipeLevel, variantDef } from '../pipes/level.js';
import { CAREER_DOSAGE, CHAINS } from '../data/levels-data.js';
import { TOWNS, CLIENTS } from './data.js';

const LETTERS = ['R', 'Y', 'B'];
const PERMS = [
  { R: 'R', Y: 'Y', B: 'B' }, { R: 'R', Y: 'B', B: 'Y' }, { R: 'Y', Y: 'R', B: 'B' },
  { R: 'Y', Y: 'B', B: 'R' }, { R: 'B', Y: 'R', B: 'Y' }, { R: 'B', Y: 'Y', B: 'R' },
];

export function permuteComp(comp, perm) {
  if (!perm) return comp.slice();
  const out = comp.slice();
  LETTERS.forEach((p, i) => { out[LETTERS.indexOf(perm[p])] = comp[i]; });
  return out;
}

export function permuteDosage(lv, perm) {
  return {
    ...lv,
    sources: lv.sources.map((s) => ({ ...s, comp: permuteComp(s.comp, perm) })),
    orders: lv.orders.map((o) => ({ ...o, ratio: permuteComp(o.ratio, perm) })),
    solution: lv.solution,
  };
}

const PIPE_TIERS = [
  ['p1', 'p2', 'p4', 'p5', 'p6'],
  ['p3', 'p6', 'p7', 'p8', 'p9', 'p10'],
  ['p8', 'p9', 'p10', 'p11', 'p12', 'p13'],
  ['p11', 'p12', 'p13', 'p14', 'p15'],
];
const CHAIN_TIERS = [[], [], [0, 1, 2, 3, 4, 5], [4, 5, 6, 7, 8, 9, 10, 11]];

/** Construit l'énigme décrite par un contrat. */
export function buildPuzzle(c) {
  if (c.type === 'dosage') {
    const base = CAREER_DOSAGE[c.tier - 1][c.ref];
    return { type: 'dosage', level: permuteDosage(base, c.perm) };
  }
  if (c.type === 'pipes') {
    const def = PIPE_LEVELS.find((d) => d.id === c.ref);
    return { type: 'pipes', level: buildPipeLevel(variantDef(def, { mirror: c.mirror, perm: c.perm })) };
  }
  const ch = CHAINS[c.ref];
  return { type: 'chain', chain: ch, perm: c.perm, mirror: false };
}

/** Prérequis (améliorations) nécessaires pour accepter le contrat. */
export function requirementsOf(c) {
  const req = new Set();
  const colorReq = (comp) => { if (comp[2] > 0) req.add('B'); if (comp[3] > 0) req.add('W'); };
  const dosageReq = (lv) => { lv.sources.forEach((s) => colorReq(s.comp)); if (lv.caps.length >= 3) req.add('flask3'); };
  const pipeReq = (pl) => {
    pl.cells.forEach((cell) => { if (cell && cell.kind === 'src') colorReq(cell.color); });
    for (const k of ['S', 'X', 'M']) if (pl.inventory[k] > 0) req.add(k);
  };
  const p = buildPuzzle(c);
  if (p.type === 'dosage') dosageReq(p.level);
  else if (p.type === 'pipes') pipeReq(p.level);
  else {
    req.add('alembic');
    const { pipe, dosage } = chainLevels(p.chain, p.perm);
    pipeReq(pipe); dosageReq(dosage);
  }
  return [...req];
}

/** Les deux étapes d'une chaîne, avec permutation de couleurs éventuelle. */
export function chainLevels(chain, perm) {
  let def = variantDef(PIPE_LEVELS.find((d) => d.id === chain.pipe.base), chain.pipe);
  if (perm) def = variantDef(def, { perm });
  const pipe = buildPipeLevel({ ...def, id: chain.id + '-t', name: chain.name });
  const dosage = perm ? permuteDosage(chain.dosage, perm) : chain.dosage;
  return { pipe, dosage };
}

const REWARD = { dosage: [24, 38, 58, 85], pipes: [22, 36, 55, 80], chain: [0, 0, 95, 135] };
const REP = [3, 5, 7, 10];

export function generateBoard(seed, day, unlockedTowns, owned) {
  const rng = new Rng(`${seed}|board|${day}`);
  const towns = TOWNS.filter((t) => unlockedTowns.includes(t.id));
  const count = 3 + (towns.length >= 3 ? 1 : 0) + (towns.length >= 4 ? 1 : 0);
  const offers = [];
  for (let i = 0; i < count; i++) {
    // Les villes les plus prestigieuses sont un peu plus fréquentes.
    const weighted = towns.flatMap((t, k) => Array(k + 1).fill(t));
    const town = rng.pick(weighted);
    const tier = town.tier;
    const types = ['dosage', 'pipes'];
    if (CHAIN_TIERS[tier - 1].length) types.push('chain');
    const type = rng.pick(types);
    offers.push(makeContract(rng, { seed, day, i, town, tier, type }));
  }
  // Garantie anti-blocage : au moins deux contrats accessibles avec l'équipement actuel.
  const ok = (c) => c.requires.every((r) => owned.includes(r));
  for (let k = 0; k < 60 && offers.filter(ok).length < Math.min(2, offers.length); k++) {
    const c = makeContract(rng, { seed, day, i: 'g' + k, town: TOWNS[0], tier: 1, type: rng.pick(['dosage', 'pipes']) });
    if (ok(c)) offers[offers.findIndex((x) => !ok(x))] = c;
  }
  return offers;
}

function makeContract(rng, { day, i, town, tier, type }) {
  let ref;
  if (type === 'dosage') ref = rng.int(0, CAREER_DOSAGE[tier - 1].length - 1);
  else if (type === 'pipes') ref = rng.pick(PIPE_TIERS[tier - 1]);
  else ref = rng.pick(CHAIN_TIERS[tier - 1]);
  const perm = rng.pick(PERMS);
  const c = {
    id: `${day}-${i}`,
    type, tier, town: town.id, ref, perm, mirror: type === 'pipes' && rng.chance(0.5),
    client: rng.pick(CLIENTS[type]),
    reward: REWARD[type][tier - 1] + rng.int(0, 6),
    rep: REP[tier - 1] + (type === 'chain' ? 3 : 0),
    deadline: rng.int(2, 5),
  };
  c.requires = requirementsOf(c);
  return c;
}
