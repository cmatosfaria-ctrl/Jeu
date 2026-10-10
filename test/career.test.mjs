import test from 'node:test';
import assert from 'node:assert/strict';
import { newCareer, accept, complete, nextDay, buyUpgrade, marketOf, payout, missingReqs, notebookSize, doseCost } from '../js/career/career.js';
import { generateBoard, buildPuzzle, requirementsOf, chainLevels, permuteComp } from '../js/career/contracts.js';
import { CAREER_DOSAGE, CHAINS, DOSAGE_CHAPTERS } from '../js/data/levels-data.js';
import { initialState, applyMove, checkMove } from '../js/dosage/engine.js';
import { solve } from '../js/dosage/solver.js';
import { chainSourcesFromPipe } from '../js/chain/chain.js';

test('tableau des contrats reproductible et toujours un contrat accessible', () => {
  for (let d = 1; d <= 30; d++) {
    const a = generateBoard('graine', d, ['bourg'], ['M']);
    const b = generateBoard('graine', d, ['bourg'], ['M']);
    assert.deepEqual(a, b);
    assert.ok(a.filter((c) => c.requires.every((r) => r === 'M')).length >= 2, 'jour ' + d);
  }
});

test('accepter, terminer, payer, passer le jour', () => {
  const st = newCareer('test');
  const c = st.board.find((x) => missingReqs(st, x).length === 0);
  assert.equal(accept(st, c.id), null);
  assert.equal(st.notebook.length, 1);
  const gold = st.gold;
  const r = complete(st, c.id, 3, 5);
  assert.equal(st.day, 2);
  assert.equal(st.gold, gold + r.net);
  assert.ok(st.rep > 0);
});

test('échéance dépassée = perte de réputation', () => {
  const st = newCareer('test2');
  st.rep = 20;
  const c = st.board.find((x) => missingReqs(st, x).length === 0);
  accept(st, c.id);
  for (let i = 0; i <= c.deadline; i++) nextDay(st);
  assert.equal(st.notebook.length, 0);
  assert.equal(st.rep, 20 - c.rep);
  assert.equal(st.stats.failed, 1);
});

test('carnet limité, achats, marché', () => {
  const st = newCareer('test3');
  st.gold = 1000;
  assert.equal(notebookSize(st), 3);
  assert.equal(buyUpgrade(st, 'slot2'), 'Il faut d\'abord le Grand carnet.');
  assert.equal(buyUpgrade(st, 'slot1'), null);
  assert.equal(notebookSize(st), 4);
  const m1 = marketOf(st, 5), m2 = marketOf(st, 5);
  assert.deepEqual(m1, m2);
  assert.ok(m1.prices.R > 0);
  assert.equal(doseCost({ R: 2, Y: 4, B: 0, W: 0 }, [1, 1, 0, 0], 2), 6);
  assert.equal(payout(st, { reward: 40, rep: 4 }, 2, 3.4).net, 27);
});

test('fin de saison', () => {
  const st = newCareer('fin');
  for (let i = 0; i < 30; i++) nextDay(st);
  assert.ok(st.ended);
});

test('toutes les énigmes de contrats sont valides (avec permutations)', () => {
  const perms = [{ R: 'B', Y: 'R', B: 'Y' }, null];
  for (let d = 1; d <= 20; d++) {
    for (const c of generateBoard('valid', d, ['bourg', 'port', 'cime', 'or'], [])) {
      const p = buildPuzzle(c);
      requirementsOf(c);
      if (p.type === 'dosage') {
        const lv = p.level;
        let s = initialState(lv);
        for (const m of lv.solution) { assert.equal(checkMove(lv, s, m), null); s = applyMove(lv, s, m).state; }
        assert.ok(s.done.every(Boolean));
      }
    }
  }
  for (const ch of CHAINS) for (const perm of perms) {
    const { pipe, dosage } = chainLevels(ch, perm);
    // Les sources du dosage = cuves du réseau
    assert.deepEqual(chainSourcesFromPipe(pipe).map((s) => s.comp), dosage.sources.slice(0, chainSourcesFromPipe(pipe).length).map((s) => s.comp));
    let s = initialState(dosage);
    for (const m of dosage.solution) s = applyMove(dosage, s, m).state;
    assert.ok(s.done.every(Boolean), ch.id);
  }
  assert.deepEqual(permuteComp([1, 2, 3, 4], { R: 'B', Y: 'R', B: 'Y' }), [2, 3, 1, 4]);
});

test('niveaux du grimoire : solution stockée valide et optimale', () => {
  for (const ch of DOSAGE_CHAPTERS) for (const lv of ch) {
    let s = initialState(lv);
    for (const m of lv.solution) s = applyMove(lv, s, m).state;
    assert.ok(s.done.every(Boolean), lv.id);
  }
  // Optimalité vérifiée sur un échantillon
  for (const lv of [DOSAGE_CHAPTERS[1][0], DOSAGE_CHAPTERS[2][3]]) assert.equal(solve(lv, initialState(lv)).cost, lv.par);
  assert.ok(CAREER_DOSAGE.length === 4);
});
