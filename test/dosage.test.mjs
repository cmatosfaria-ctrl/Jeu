import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, applyMove, matches, checkMove, flaskRatio, starsFor } from '../js/dosage/engine.js';
import { solve } from '../js/dosage/solver.js';

const R = [1, 0, 0, 0], Y = [0, 1, 0, 0], B = [0, 0, 1, 0];

test('remplir puis verser partiellement conserve la proportion', () => {
  const lv = { caps: [4, 3], sources: [{ comp: R }, { comp: B }], orders: [] };
  let s = initialState(lv);
  s = applyMove(lv, s, { t: 'fill', s: 0, f: 1 }).state; // 3R dans la petite
  s = applyMove(lv, s, { t: 'pour', a: 1, b: 0 }).state;  // 3R dans la grande
  s = applyMove(lv, s, { t: 'fill', s: 1, f: 1 }).state;  // 3B
  s = applyMove(lv, s, { t: 'pour', a: 1, b: 0 }).state;  // 1B => grande 3R+1B, petite 2B
  assert.deepEqual(flaskRatio(s.flasks[0]), [3, 0, 1, 0]);
  assert.equal(s.flasks[1].vol, 2);
  s = applyMove(lv, s, { t: 'empty', f: 1 }).state;
  s = applyMove(lv, s, { t: 'pour', a: 0, b: 1 }).state;  // 3 doses de 3:1 versées
  assert.deepEqual(flaskRatio(s.flasks[1]), [3, 0, 1, 0]);
  assert.equal(s.flasks[0].vol, 1);
  assert.deepEqual(flaskRatio(s.flasks[0]), [3, 0, 1, 0]);
});

test('livraison exacte uniquement', () => {
  const lv = { caps: [2], sources: [{ comp: R }, { comp: Y }], orders: [{ vol: 2, ratio: [1, 1, 0, 0] }] };
  let s = initialState(lv);
  s = applyMove(lv, s, { t: 'fill', s: 0, f: 0 }).state;
  assert.equal(matches(s.flasks[0], lv.orders[0]), false);
  assert.match(checkMove(lv, s, { t: 'deliver', f: 0, o: 0 }), /proportions/);
});

test('stock limité', () => {
  const lv = { caps: [5], sources: [{ comp: R, stock: 3 }], orders: [] };
  let s = initialState(lv);
  const r = applyMove(lv, s, { t: 'fill', s: 0, f: 0 });
  assert.equal(r.state.flasks[0].vol, 3);
  assert.equal(r.drawn, 3);
  assert.match(checkMove(lv, r.state, { t: 'fill', s: 0, f: 0 }), /épuisée/);
});

test('solveur : bidons 5 et 3 -> 4 doses', () => {
  const lv = { caps: [5, 3], sources: [{ comp: B }], orders: [{ vol: 4, ratio: [0, 0, 1, 0] }] };
  const r = solve(lv, initialState(lv));
  assert.equal(r.cost, 6);
  // Rejouer le chemin donne la victoire
  let s = initialState(lv);
  for (const m of r.path) { assert.equal(checkMove(lv, s, m), null); s = applyMove(lv, s, m).state; }
  assert.ok(s.done.every(Boolean));
});

test('solveur : mélange 1:1', () => {
  const lv = { caps: [4, 2], sources: [{ comp: R }, { comp: B }], orders: [{ vol: 4, ratio: [1, 0, 1, 0] }] };
  assert.equal(solve(lv, initialState(lv)).cost, 3); // 2B, verser, compléter en R
});

test('étoiles', () => {
  assert.equal(starsFor(4, 4), 3);
  assert.equal(starsFor(6, 4), 2);
  assert.equal(starsFor(7, 4), 1);
  assert.equal(starsFor(4, 4, true), 2);
});
