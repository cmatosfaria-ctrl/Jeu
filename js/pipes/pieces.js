// Pièces de tuyauterie. Directions : 0 = N, 1 = E, 2 = S, 3 = O. Rotation horaire par quarts de tour.
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const opposite = (d) => (d + 2) % 4;
const rot = (d, r) => (d + r) % 4;

export const PIECES = {
  I: { name: 'Droit', rotations: 2, pairs: [[0, 2]] },
  L: { name: 'Coude', rotations: 4, pairs: [[0, 1]] },
  X: { name: 'Croisement', rotations: 1, pairs: [[0, 2], [1, 3]] },
  S: { name: 'Séparateur', rotations: 4, ins: [2], outs: [3, 1] },
  M: { name: 'Mélangeur', rotations: 4, ins: [3, 1], outs: [0] },
};
export const PIECE_ORDER = ['I', 'L', 'X', 'S', 'M'];

/** Côtés ouverts d'une pièce posée (pour le dessin). */
export function openSides(type, r) {
  const P = PIECES[type];
  if (P.pairs) return P.pairs.flat().map((d) => rot(d, r));
  return [...P.ins, ...P.outs].map((d) => rot(d, r));
}

/**
 * Où va un flux qui entre par le côté `side` ?
 * Renvoie { outs: [côtés], split: bool, mixIn: bool } ou null si le côté est fermé / mauvais sens.
 */
export function route(type, r, side) {
  const P = PIECES[type];
  if (P.pairs) {
    for (const [a, b] of P.pairs) {
      const ra = rot(a, r), rb = rot(b, r);
      if (side === ra) return { outs: [rb] };
      if (side === rb) return { outs: [ra] };
    }
    return null;
  }
  const ins = P.ins.map((d) => rot(d, r));
  if (!ins.includes(side)) return null;
  return { outs: P.outs.map((d) => rot(d, r)), split: type === 'S', mix: type === 'M', ins };
}
