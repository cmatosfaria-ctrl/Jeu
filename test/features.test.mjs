import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS } from '../js/achievements.js';
import { taPool, taPoints } from '../js/ui/timeattack.js';
import { initialState, applyMove } from '../js/dosage/engine.js';

test('succès : identifiants uniques, ~40 succès, définitions complètes', () => {
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  assert.equal(ids.size, ACHIEVEMENTS.length);
  assert.ok(ACHIEVEMENTS.length >= 40);
  for (const a of ACHIEVEMENTS) assert.ok(a.name && a.desc && a.icon && (a.stat || a.test), a.id);
});

test('contre-la-montre : énigmes valides et points', () => {
  const pool = taPool(42);
  assert.ok(pool.length > 30);
  for (const lv of pool.slice(0, 15)) {
    let s = initialState(lv);
    for (const m of lv.solution) s = applyMove(lv, s, m).state;
    assert.ok(s.done.every(Boolean));
    assert.ok(!lv.reactions);
  }
  assert.ok(taPoints(4, 4, 1) > taPoints(9, 4, 1));
  assert.ok(taPoints(4, 4, 3) > taPoints(4, 4, 1));
});
