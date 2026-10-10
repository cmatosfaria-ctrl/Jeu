// État et règles de la Carrière (gestion d'atelier).
import { Rng } from '../core/rng.js';
import { PRIMARIES } from '../core/color.js';
import { SEASON_DAYS, START_GOLD, START_OWNED, TOWNS, UPGRADES, BASE_PRICES, PIECE_PRICES, HINT_PACK, rankFor, GOAL_REP } from './data.js';
import { generateBoard } from './contracts.js';

export function newCareer(seed = Date.now() % 1e9) {
  const st = {
    v: 1, seed: String(seed), day: 1, gold: START_GOLD, rep: 0, hints: 3,
    owned: START_OWNED.slice(), board: [], notebook: [], log: [], free: false, ended: false,
    stats: { done: 0, failed: 0, stars: 0, earned: 0 },
  };
  st.board = generateBoard(st.seed, st.day, unlockedTowns(st), st.owned);
  addLog(st, 'Ton atelier ouvre ses portes à Bourg-Fiole. Bonne chance, apprenti !');
  return st;
}

export const unlockedTowns = (st) => TOWNS.filter((t) => st.rep >= t.rep).map((t) => t.id);
export const notebookSize = (st) => 3 + (st.owned.includes('slot1') ? 1 : 0) + (st.owned.includes('slot2') ? 1 : 0);
export const missingReqs = (st, c) => c.requires.filter((r) => !st.owned.includes(r));

function addLog(st, msg) {
  st.log.unshift({ day: st.day, msg });
  st.log = st.log.slice(0, 40);
}

/** Prix du marché du jour pour chaque primaire (+ événement éventuel). */
export function marketOf(st, day = st.day) {
  const rng = new Rng(`${st.seed}|market|${day}`);
  const prices = {};
  for (const p of PRIMARIES) prices[p] = BASE_PRICES[p] * (0.6 + Math.round(rng.next() * 4) * 0.2);
  let event = null;
  if (rng.chance(0.35)) {
    const p = rng.pick(PRIMARIES);
    const up = rng.chance(0.5);
    prices[p] *= up ? 1.8 : 0.5;
    const names = { R: 'rouge', Y: 'jaune', B: 'bleu', W: 'blanc' };
    event = up ? `Pénurie de pigment ${names[p]} : les prix s'envolent !` : `Arrivage de pigment ${names[p]} : prix cassés !`;
  }
  const disc = st.owned.includes('reservoir') ? 0.75 : 1;
  for (const p of PRIMARIES) prices[p] = Math.round(prices[p] * disc * 100) / 100;
  return { prices, event };
}

export function pieceCost(st, type) {
  return PIECE_PRICES[type] * (st.owned.includes('reservoir') ? 0.75 : 1);
}

/** Coût d'un remplissage de q doses d'une source de composition comp. */
export function doseCost(prices, comp, q) {
  const sum = comp.reduce((a, b) => a + b, 0);
  return comp.reduce((acc, c, i) => acc + (c / sum) * prices[PRIMARIES[i]] * q, 0);
}

export function accept(st, id) {
  const c = st.board.find((x) => x.id === id);
  if (!c) return 'Contrat introuvable.';
  if (st.notebook.length >= notebookSize(st)) return 'Ton carnet est plein.';
  const miss = missingReqs(st, c);
  if (miss.length) return 'Équipement manquant.';
  st.board = st.board.filter((x) => x.id !== id);
  st.notebook.push({ ...c, due: st.day + c.deadline - 1 });
  return null;
}

export function abandon(st, id) {
  const c = st.notebook.find((x) => x.id === id);
  if (!c) return;
  st.notebook = st.notebook.filter((x) => x.id !== id);
  const loss = Math.ceil(c.rep / 2);
  st.rep = Math.max(0, st.rep - loss);
  addLog(st, `Contrat abandonné (${c.client}) : −${loss} réputation.`);
}

export const STAR_FACTOR = { 1: 0.5, 2: 0.75, 3: 1 };

/** Calcule le paiement d'un contrat réussi. */
export function payout(st, c, stars, costs) {
  const bonus = st.owned.includes('vitrine') ? 1.15 : 1;
  const gross = Math.round(c.reward * STAR_FACTOR[stars] * bonus);
  const cost = Math.round(costs);
  const rep = Math.max(1, c.rep - (3 - stars));
  return { gross, cost, net: gross - cost, rep };
}

/** Contrat terminé : encaissement, réputation, une journée passe. */
export function complete(st, id, stars, costs) {
  const c = st.notebook.find((x) => x.id === id);
  if (!c) return null;
  const p = payout(st, c, stars, costs);
  st.notebook = st.notebook.filter((x) => x.id !== id);
  const before = unlockedTowns(st);
  const rankBefore = rankFor(st.rep).name;
  st.gold += p.net;
  st.rep += p.rep;
  st.stats.done++; st.stats.stars += stars; st.stats.earned += p.net;
  addLog(st, `${c.client} : ${'★'.repeat(stars)} +${p.net} or, +${p.rep} réputation.`);
  const news = [];
  for (const t of TOWNS) if (!before.includes(t.id) && st.rep >= t.rep) news.push(`Nouvelle ville : ${t.name} !`);
  const rankAfter = rankFor(st.rep).name;
  if (rankAfter !== rankBefore) news.push(`Nouveau rang : ${rankAfter} !`);
  news.forEach((n) => addLog(st, n));
  const dayNews = nextDay(st);
  return { ...p, news: [...news, ...dayNews] };
}

/** Passe au jour suivant : échéances, nouveau tableau, fin de saison. */
export function nextDay(st) {
  const news = [];
  st.day++;
  for (const c of st.notebook.filter((x) => st.day > x.due)) {
    st.rep = Math.max(0, st.rep - c.rep);
    st.stats.failed++;
    const m = `Échéance dépassée (${c.client}) : −${c.rep} réputation.`;
    addLog(st, m); news.push(m);
  }
  st.notebook = st.notebook.filter((x) => st.day <= x.due);
  st.board = generateBoard(st.seed, st.day, unlockedTowns(st), st.owned);
  const ev = marketOf(st).event;
  if (ev) addLog(st, ev);
  if (!st.free && st.day > SEASON_DAYS) { st.ended = true; news.push('La saison est terminée !'); }
  return news;
}

export function buyUpgrade(st, id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || st.owned.includes(id)) return 'Déjà acquis.';
  if (u.needs && !st.owned.includes(u.needs)) return 'Il faut d\'abord le Grand carnet.';
  if (st.gold < u.cost) return 'Pas assez d\'or.';
  st.gold -= u.cost;
  st.owned.push(id);
  addLog(st, `Achat : ${u.name}.`);
  // Les contrats du jour qui deviennent accessibles le restent ; le tableau n'est pas régénéré.
  return null;
}

export function buyHints(st) {
  if (st.gold < HINT_PACK.cost) return 'Pas assez d\'or.';
  st.gold -= HINT_PACK.cost;
  st.hints += HINT_PACK.count;
  return null;
}

export function finalScore(st) {
  return st.gold + st.rep * 10;
}

export function seasonVerdict(st) {
  return st.rep >= GOAL_REP
    ? 'Le roi te nomme Grand Alchimiste du royaume !'
    : `Tu termines la saison au rang de ${rankFor(st.rep).name}.`;
}

export function continueFree(st) {
  st.free = true; st.ended = false;
}
