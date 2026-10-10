// Succès : compteurs persistants, définitions, déblocage avec notification.
import { load, save } from './storage.js';

/**
 * Chaque succès : { id, name, desc, icon, stat?: [compteur, objectif] , test?: (s, ctx) => bool }
 * Les compteurs (stats) sont incrémentés par track().
 */
export const ACHIEVEMENTS = [
  // Grimoire
  { id: 'lv1', icon: '📖', name: 'Premiers pas', desc: 'Réussir un niveau du grimoire.', stat: ['levels', 1] },
  { id: 'lv10', icon: '📗', name: 'Apprenti assidu', desc: 'Réussir 10 niveaux.', stat: ['levels', 10] },
  { id: 'lv30', icon: '📘', name: 'Habitué du grimoire', desc: 'Réussir 30 niveaux.', stat: ['levels', 30] },
  { id: 'lv60', icon: '📚', name: 'Érudit', desc: 'Réussir 60 niveaux.', stat: ['levels', 60] },
  { id: 'lvall', icon: '🏛', name: 'Grimoire complet', desc: 'Réussir tous les niveaux du grimoire.', test: (s, c) => (s.levels || 0) >= (c.totalLevels || Infinity) },
  { id: 'p1', icon: '⭐', name: 'Sans bavure', desc: 'Obtenir 3 étoiles sur un niveau.', stat: ['perfect', 1] },
  { id: 'p20', icon: '🌟', name: 'Perfectionniste', desc: 'Obtenir 3 étoiles sur 20 niveaux.', stat: ['perfect', 20] },
  { id: 'p50', icon: '✨', name: 'Main d\'orfèvre', desc: 'Obtenir 3 étoiles sur 50 niveaux.', stat: ['perfect', 50] },
  { id: 'dos25', icon: '⚗', name: 'Doseur', desc: 'Réussir 25 niveaux de dosage.', stat: ['lv_dosage', 25] },
  { id: 'pip5', icon: '🔧', name: 'Plombier', desc: 'Réussir 5 niveaux de tuyauterie.', stat: ['lv_pipes', 5] },
  { id: 'pip22', icon: '🚰', name: 'Maître des eaux', desc: 'Réussir les 22 niveaux de tuyauterie.', stat: ['lv_pipes', 22] },
  { id: 'ch3', icon: '⛓', name: 'Chaîne de montage', desc: 'Réussir 3 chaînes de production.', stat: ['lv_chain', 3] },
  { id: 'ch12', icon: '👑', name: 'Grand Œuvre', desc: 'Réussir les 12 chaînes de production.', stat: ['lv_chain', 12] },
  { id: 'react5', icon: '🧪', name: 'Laboratoire instable', desc: 'Réussir 5 niveaux à réactions.', stat: ['lv_react', 5] },
  { id: 'nohint10', icon: '🧠', name: 'Sans filet', desc: 'Réussir 10 niveaux sans indice.', stat: ['nohint', 10] },
  { id: 'hint1', icon: '💡', name: 'Coup de pouce', desc: 'Utiliser un indice.', stat: ['hints', 1] },
  // Réactions & gestes
  { id: 'boom1', icon: '💥', name: 'Boum !', desc: 'Provoquer une explosion.', stat: ['r_boom', 1] },
  { id: 'boom10', icon: '🧨', name: 'Artificier', desc: 'Provoquer 10 explosions.', stat: ['r_boom', 10] },
  { id: 'cri1', icon: '❄', name: 'Givre', desc: 'Cristalliser un mélange.', stat: ['r_cristal', 1] },
  { id: 'mou1', icon: '🫧', name: 'Mousseux', desc: 'Faire mousser un mélange.', stat: ['r_mousse', 1] },
  { id: 'eva1', icon: '♨', name: 'Volatil', desc: 'Faire s\'évaporer un mélange.', stat: ['r_evap', 1] },
  { id: 'react4', icon: '☯', name: 'Alchimiste complet', desc: 'Déclencher les quatre réactions.', test: (s) => ['r_boom', 'r_cristal', 'r_mousse', 'r_evap'].every((k) => s[k] > 0) },
  { id: 'pour100', icon: '🫗', name: 'Main sûre', desc: 'Verser ou remplir 100 fois.', stat: ['pours', 100] },
  { id: 'pour1000', icon: '🌊', name: 'Infatigable', desc: 'Verser ou remplir 1 000 fois.', stat: ['pours', 1000] },
  { id: 'pc100', icon: '🔩', name: 'Tuyauteur', desc: 'Poser 100 pièces de tuyauterie.', stat: ['pieces', 100] },
  { id: 'burst1', icon: '💨', name: 'Ça siffle !', desc: 'Faire céder un tuyau sous la pression.', stat: ['bursts', 1] },
  { id: 'valve50', icon: '🎛', name: 'Robinetier', desc: 'Manœuvrer 50 vannes.', stat: ['valves', 50] },
  // Carrière
  { id: 'ct1', icon: '🤝', name: 'Premier client', desc: 'Remplir un contrat.', stat: ['contracts', 1] },
  { id: 'ct25', icon: '🏪', name: 'Atelier réputé', desc: 'Remplir 25 contrats.', stat: ['contracts', 25] },
  { id: 'ct3s10', icon: '🎖', name: 'Service impeccable', desc: 'Remplir 10 contrats avec 3 étoiles.', stat: ['contracts3', 10] },
  { id: 'rk1', icon: '⚙', name: 'Compagnon', desc: 'Atteindre le rang de Compagnon.', stat: ['maxRep', 15] },
  { id: 'rk2', icon: '🛠', name: 'Artisan', desc: 'Atteindre le rang d\'Artisan.', stat: ['maxRep', 40] },
  { id: 'rk3', icon: '🎩', name: 'Maître', desc: 'Atteindre le rang de Maître.', stat: ['maxRep', 80] },
  { id: 'rk4', icon: '🔮', name: 'Grand Alchimiste', desc: 'Atteindre le rang de Grand Alchimiste.', stat: ['maxRep', 130] },
  { id: 'gold500', icon: '💰', name: 'Coffre plein', desc: 'Posséder 500 pièces d\'or.', stat: ['maxGold', 500] },
  { id: 'allup', icon: '🏭', name: 'Atelier équipé', desc: 'Acheter toutes les améliorations.', test: (s, c) => (s.upgrades || 0) >= (c.totalUpgrades || Infinity) },
  { id: 'ontime', icon: '⏰', name: 'Ponctuel', desc: 'Finir une saison sans aucun retard.', stat: ['seasonsOnTime', 1] },
  // Défi du jour
  { id: 'dy1', icon: '📅', name: 'Rituel', desc: 'Réussir un défi du jour.', stat: ['dailies', 1] },
  { id: 'dy3', icon: '🔥', name: 'Fidèle', desc: 'Série de 3 défis du jour.', stat: ['maxStreak', 3] },
  { id: 'dy7', icon: '🏆', name: 'Dévoué', desc: 'Série de 7 défis du jour.', stat: ['maxStreak', 7] },
  // Contre-la-montre
  { id: 'ta5', icon: '⏱', name: 'Rapide', desc: 'Résoudre 5 énigmes en une partie contre-la-montre.', stat: ['taSolved', 5] },
  { id: 'ta10', icon: '⚡', name: 'Éclair', desc: 'Résoudre 10 énigmes en une partie contre-la-montre.', stat: ['taSolved', 10] },
  { id: 'tacombo', icon: '🎯', name: 'En rythme', desc: 'Atteindre un combo ×5 en contre-la-montre.', stat: ['taCombo', 5] },
  { id: 'ta3k', icon: '🚀', name: 'Turbine', desc: 'Marquer 3 000 points en contre-la-montre.', stat: ['taScore', 3000] },
];

let ctxInfo = {};
let notify = () => {};

/** Contexte (totaux) et fonction d'affichage, fournis par l'interface au démarrage. */
export function initAchievements(info, notifier) { ctxInfo = info; notify = notifier; }

const MAX_STATS = new Set(['maxRep', 'maxGold', 'maxStreak', 'taSolved', 'taCombo', 'taScore', 'upgrades']);

/** Incrémente (ou porte au maximum) des compteurs, puis vérifie les succès. */
export function track(changes) {
  const d = load();
  d.stats = d.stats || {};
  d.ach = d.ach || {};
  for (const [k, v] of Object.entries(changes)) {
    if (MAX_STATS.has(k)) d.stats[k] = Math.max(d.stats[k] || 0, v);
    else d.stats[k] = (d.stats[k] || 0) + v;
  }
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (d.ach[a.id]) continue;
    const ok = a.stat ? (d.stats[a.stat[0]] || 0) >= a.stat[1] : a.test(d.stats, ctxInfo);
    if (ok) { d.ach[a.id] = Date.now(); fresh.push(a); }
  }
  save();
  fresh.forEach((a, i) => setTimeout(() => notify(a), 600 + i * 2600));
  return fresh;
}

export function progressOf(a) {
  const d = load();
  const s = d.stats || {};
  if (a.stat) return Math.min(1, (s[a.stat[0]] || 0) / a.stat[1]);
  return d.ach?.[a.id] ? 1 : 0;
}
