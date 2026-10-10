// Génère js/data/levels-data.js : niveaux de Dosage, Chaînes et réserve de contrats de la Carrière.
// Déterministe (graines fixes). Chaque niveau est vérifié par le solveur.
import { writeFileSync } from 'node:fs';
import { generateDosage, pureComp } from '../js/dosage/generator.js';
import { solve } from '../js/dosage/solver.js';
import { initialState } from '../js/dosage/engine.js';
import { chainPipeLevel, chainSourcesFromPipe } from '../js/chain/chain.js';

const src = (letters) => [...letters].map((p) => ({ comp: pureComp(p) }));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

function finalize(id, name, lv, extra = {}) {
  const res = solve(lv, initialState(lv), { maxNodes: 400000 });
  if (!res) throw new Error(`Niveau ${id} insoluble`);
  return { id, name, caps: lv.caps, sources: lv.sources, orders: lv.orders, par: res.cost, solution: res.path, ...extra };
}

const NAMES = [
  'Fiole d\'essai', 'Goutte à goutte', 'Juste mesure', 'Alambic', 'Cornue', 'Décoction', 'Teinture', 'Élixir',
  'Philtre', 'Quintessence', 'Infusion', 'Macération', 'Distillat', 'Onguent', 'Baume', 'Sirop', 'Tisane',
  'Essence', 'Nectar', 'Potion', 'Émulsion', 'Sublimé', 'Précipité', 'Solution', 'Mixture', 'Breuvage',
  'Tonique', 'Cordial', 'Lotion', 'Vernis', 'Encre', 'Glacis', 'Pigment', 'Laque', 'Pastel', 'Aquarelle',
];

// ---------- Dosage : grimoire ----------
const tutorials = [
  finalize('d1', 'Premier remplissage', { caps: [3], sources: src('R'), orders: [{ vol: 3, ratio: [1, 0, 0, 0] }] },
    { tutorial: true, tip: 'Touche la source rouge, puis la fiole : elle se remplit jusqu\'en haut. Touche ensuite la fiole puis la commande pour la livrer.' }),
  finalize('d2', 'Mesurer', { caps: [4, 1], sources: src('B'), orders: [{ vol: 3, ratio: [0, 0, 1, 0] }] },
    { tutorial: true, tip: 'Touche une fiole puis une autre pour verser : on verse tant que la première n\'est pas vide et la seconde pas pleine.' }),
  finalize('d3', 'Premier mélange', { caps: [4, 2], sources: src('RY'), orders: [{ vol: 4, ratio: [1, 1, 0, 0] }] },
    { tutorial: true, tip: 'Les liquides se mélangent. Il faut exactement le bon volume ET les bonnes proportions (ici 1 Rouge pour 1 Jaune).' }),
  finalize('d4', 'Les bidons', { caps: [5, 3], sources: src('B'), orders: [{ vol: 4, ratio: [0, 0, 1, 0] }] },
    { tutorial: true, tip: 'L\'évier (en bas à droite) vide une fiole. Comment obtenir 4 doses avec des fioles de 5 et 3 ?' }),
];

const CHAPTERS = [
  { id: 'c1', count: 6, cfg: (i) => ({ sources: src(['RY', 'RB', 'YB'][i % 3]), capsChoices: [[5, 3], [4, 3], [5, 2], [6, 4], [7, 3]], par: [3, 6], minColors: i < 2 ? 1 : 2 }) },
  { id: 'c2', count: 10, cfg: (i) => ({ sources: src(['RY', 'RB', 'YB', 'RW', 'BW'][i % 5]), capsChoices: [[5, 3], [7, 4], [5, 3, 2], [6, 4, 3], [7, 5]], par: [5, 9], minColors: 2, maxPart: 5 }) },
  { id: 'c3', count: 10, cfg: (i) => ({ sources: src(i % 4 === 3 ? 'RYBW' : 'RYB'), capsChoices: [[5, 3, 2], [4, 3, 2], [6, 4, 3], [5, 4, 2]], par: [6, 10], minColors: i < 5 ? 2 : 3, maxPart: 5 }) },
  { id: 'c4', count: 10, cfg: (i) => ({ sources: src(['RY', 'RB', 'RYB', 'YB', 'RYB'][i % 5]), capsChoices: [[5, 3], [4, 3, 2], [5, 3, 2], [6, 4]], par: [7, 12], minColors: 2, stockRange: [4, 9], orders: i % 3 === 2 ? 2 : 1, maxPart: 5 }) },
];

function genSeries(prefix, count, cfgFn, nameOffset, seedBase) {
  const out = [];
  let seed = 0;
  for (let i = 0; i < count; i++) {
    let lv = null;
    while (!lv) {
      const cfg = { ...cfgFn(i), seed: `${seedBase}-${i}-${seed++}`, tries: 10, maxNodes: 80000 };
      lv = generateDosage(cfg);
      if (!lv && seed > 400) throw new Error('Génération impossible ' + prefix + i);
    }
    out.push(finalize(`${prefix}${i + 1}`, '', lv));
    log(prefix + (i + 1), 'opt', out[i].par, JSON.stringify(lv.orders.map((o) => o.vol + '×' + o.ratio.join(':'))));
  }
  // Difficulté croissante : tri par nombre de coups optimal, puis renumérotation.
  out.sort((a, b) => a.par - b.par || a.orders.length - b.orders.length);
  out.forEach((lv, i) => { lv.id = `${prefix}${i + 1}`; lv.name = NAMES[(nameOffset + i) % NAMES.length]; });
  return out;
}

const dosageChapters = [];
let nameOff = 0;
for (const ch of CHAPTERS) {
  const lv = genSeries(ch.id + '-', ch.count, ch.cfg, nameOff, 'grimoire-' + ch.id);
  nameOff += ch.count;
  dosageChapters.push(lv);
}
dosageChapters[0] = [...tutorials, ...dosageChapters[0]];

// ---------- Chaînes ----------
const CHAIN_BASES = [
  { base: 'p3' }, { base: 'p6' }, { base: 'p8', perm: { R: 'B', Y: 'R', B: 'Y' } }, { base: 'p10', mirror: true },
  { base: 'p6', mirror: true, perm: { R: 'Y', Y: 'B', B: 'R' } }, { base: 'p9' }, { base: 'p7', mirror: true },
  { base: 'p12', perm: { R: 'Y', Y: 'R', B: 'B' } }, { base: 'p13' }, { base: 'p11', mirror: true },
  { base: 'p14', mirror: true }, { base: 'p15', perm: { R: 'R', Y: 'B', B: 'Y' } },
];
const CHAIN_NAMES = ['Atelier d\'essai', 'Double cuve', 'Bleu de Prusse', 'Rose poudré', 'Duo vert', 'Mordoré',
  'Indigo profond', 'Ciel d\'orage', 'Triptyque', 'Garance', 'Terre d\'ombre', 'Grand Œuvre'];
const chains = [];
for (let i = 0; i < CHAIN_BASES.length; i++) {
  const chain = { id: `ch${i + 1}`, name: CHAIN_NAMES[i], pipe: CHAIN_BASES[i] };
  const pl = chainPipeLevel(chain);
  const sources = chainSourcesFromPipe(pl);
  // Une seule source mélangée ? On ajoute une primaire pour enrichir le dosage.
  if (sources.length === 1) sources.push({ comp: pureComp(sources[0].comp[2] ? 'Y' : 'B') });
  let lv = null, seed = 0;
  while (!lv) {
    lv = generateDosage({ seed: `chain-${i}-${seed++}`, sources, capsChoices: [[5, 3], [4, 3, 2], [6, 4], [5, 3, 2]], par: i < 4 ? [3, 7] : [5, 10], minColors: 2, maxPart: 9, tries: 8, maxNodes: 80000 });
    if (!lv && seed > 200) throw new Error('Chaîne impossible ' + i);
  }
  chains.push({ ...chain, dosage: finalize(chain.id + '-d', chain.name, lv) });
  log(chain.id, 'opt', chains[i].dosage.par);
}

// ---------- Réserve de contrats (Carrière) ----------
const TIERS = [
  { n: 10, cfg: (i) => ({ sources: src(['RY', 'RB', 'YB'][i % 3]), capsChoices: [[5, 3], [4, 3], [6, 4]], par: [3, 6], minColors: 2 }) },
  { n: 10, cfg: (i) => ({ sources: src(['RY', 'RB', 'YB', 'RW'][i % 4]), capsChoices: [[5, 3, 2], [7, 4], [6, 4, 3]], par: [5, 9], minColors: 2, maxPart: 5 }) },
  { n: 10, cfg: (i) => ({ sources: src(i % 3 === 2 ? 'RYBW' : 'RYB'), capsChoices: [[5, 3, 2], [4, 3, 2], [6, 4, 3]], par: [6, 10], minColors: 2, maxPart: 5 }) },
  { n: 10, cfg: (i) => ({ sources: src(['RYB', 'RB', 'RYBW', 'RY'][i % 4]), capsChoices: [[5, 3, 2], [4, 3, 2], [6, 4]], par: [7, 12], minColors: 2, maxPart: 5, orders: i % 2 ? 2 : 1, stockRange: i % 3 === 0 ? [5, 9] : null }) },
];
const pool = TIERS.map((t, ti) => genSeries(`k${ti + 1}-`, t.n, t.cfg, ti * 7, 'career-' + ti));

const banner = '// Fichier généré par tools/build-levels.mjs — ne pas modifier à la main.\n';
writeFileSync(new URL('../js/data/levels-data.js', import.meta.url), banner
  + `export const DOSAGE_CHAPTERS = ${JSON.stringify(dosageChapters)};\n`
  + `export const CHAINS = ${JSON.stringify(chains)};\n`
  + `export const CAREER_DOSAGE = ${JSON.stringify(pool)};\n`);
log('Terminé.');
