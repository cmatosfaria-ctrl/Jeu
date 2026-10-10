// Données de la Carrière : villes, rangs, améliorations.
export const SEASON_DAYS = 30;
export const START_GOLD = 60;
// La licence Mélangeur est offerte à l'ouverture de l'atelier.
export const START_OWNED = ['M'];

export const TOWNS = [
  { id: 'bourg', name: 'Bourg-Fiole', rep: 0, tier: 1, x: 22, y: 74, desc: 'Un village paisible : guérisseuses et teinturiers débutants.' },
  { id: 'port', name: 'Port-Azur', rep: 15, tier: 2, x: 72, y: 62, desc: 'Le port marchand : armateurs et peintres de coques.' },
  { id: 'cime', name: 'Hautecime', rep: 40, tier: 3, x: 30, y: 30, desc: 'La cité savante : l\'académie commande des réseaux complexes.' },
  { id: 'or', name: 'Cité d\'Or', rep: 80, tier: 4, x: 74, y: 18, desc: 'La capitale : la cour royale paie le prix fort.' },
];

export const RANKS = [
  { rep: 0, name: 'Apprenti' },
  { rep: 15, name: 'Compagnon' },
  { rep: 40, name: 'Artisan' },
  { rep: 80, name: 'Maître' },
  { rep: 130, name: 'Grand Alchimiste' },
];
export const GOAL_REP = 130;

export function rankFor(rep) {
  let r = RANKS[0];
  for (const k of RANKS) if (rep >= k.rep) r = k;
  return r;
}

// Prérequis : couleurs (B, W), fiole3, pièces (S, X, M), alambic (chaînes).
export const UPGRADES = [
  { id: 'B', name: 'Pigment Bleu', cost: 35, icon: 'drop-b', desc: 'Débloque les commandes contenant du bleu.' },
  { id: 'flask3', name: 'Troisième fiole', cost: 50, icon: 'flask', desc: 'Débloque les dosages à trois fioles.' },
  { id: 'S', name: 'Licence Séparateur', cost: 50, icon: 'splitter', desc: 'Autorise les réseaux avec séparateur.' },
  { id: 'W', name: 'Pigment Blanc', cost: 60, icon: 'drop-w', desc: 'Débloque les teintes pastel.' },
  { id: 'X', name: 'Licence Croisement', cost: 45, icon: 'cross', desc: 'Autorise les réseaux avec croisement.' },
  { id: 'alembic', name: 'Grand alambic', cost: 110, icon: 'alembic', desc: 'Débloque les chaînes de production (tuyaux puis dosage).' },
  { id: 'slot1', name: 'Grand carnet', cost: 70, icon: 'book', desc: '+1 contrat simultané dans le carnet.' },
  { id: 'reservoir', name: 'Réservoir', cost: 80, icon: 'barrel', desc: 'Pigments et pièces 25 % moins chers.' },
  { id: 'vitrine', name: 'Belle vitrine', cost: 120, icon: 'star', desc: '+15 % sur toutes les récompenses.' },
  { id: 'slot2', name: 'Carnet de maître', cost: 140, icon: 'book', desc: '+1 contrat simultané supplémentaire.', needs: 'slot1' },
];
export const HINT_PACK = { cost: 20, count: 2 };

export const BASE_PRICES = { R: 1, Y: 1, B: 1.2, W: 0.8 };
export const PIECE_PRICES = { I: 0.5, L: 0.5, X: 2, S: 2, M: 2 };

export const CLIENTS = {
  dosage: ['La guérisseuse', 'Le teinturier', 'L\'apothicaire', 'La parfumeuse', 'Le peintre', 'La cuisinière du château', 'L\'herboriste'],
  pipes: ['Le maître des eaux', 'La brasserie', 'La fontaine publique', 'Les bains', 'L\'atelier de verrerie', 'La distillerie'],
  chain: ['L\'Académie', 'La guilde des peintres', 'La manufacture', 'Le grand teinturier royal'],
};
