// Chaîne de production : l'étape Tuyaux fabrique les mélanges qui deviennent les sources de l'étape Dosage.
import { PIPE_LEVELS } from '../pipes/levels.js';
import { buildPipeLevel, variantDef } from '../pipes/level.js';

export function pipeDefById(id) {
  return PIPE_LEVELS.find((d) => d.id === id);
}

/** Niveau de tuyaux d'une chaîne (variante éventuelle). */
export function chainPipeLevel(chain) {
  const def = variantDef(pipeDefById(chain.pipe.base), chain.pipe);
  return buildPipeLevel({ ...def, id: chain.id + '-t', name: chain.name });
}

/** Sources du dosage = proportions produites par les cuves du réseau. */
export function chainSourcesFromPipe(pipeLevel) {
  return pipeLevel.cells.filter((c) => c && c.kind === 'tank').map((c) => ({ comp: c.target.slice() }));
}
