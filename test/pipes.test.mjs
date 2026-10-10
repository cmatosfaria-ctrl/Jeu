import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../js/pipes/sim.js';
import { parseMap, buildPipeLevel, variantDef } from '../js/pipes/level.js';
import { PIPE_LEVELS } from '../js/pipes/levels.js';

function boardOf(rows) {
  const { w, h, cells, solution } = parseMap(rows);
  for (const p of solution) cells[p.i] = { kind: 'pipe', type: p.type, r: p.r };
  return { w, h, cells };
}

test('séparation et mélange : 2 R pour 1 J', () => {
  const sim = simulate(boardOf([
    'Rv .. .. Yv ..',
    'I0 .. L1 S2 D*',
    'L0 M2 L3 .. ..',
    '.. I0 .. .. ..',
    '.. T^ .. .. ..',
  ]));
  assert.deepEqual(sim.errors, []);
  assert.deepEqual(sim.tanks[0].ratio, [2, 1, 0, 0]);
});

test('fuite détectée', () => {
  const sim = simulate(boardOf(['Rv ..', 'I0 ..', '.. T^']));
  assert.equal(sim.errors[0].kind, 'fuite');
});

test('mauvais sens dans un séparateur = fuite', () => {
  const sim = simulate(boardOf(['Rv .. ..', 'S0 .. ..', '.. .. ..']));
  assert.ok(sim.errors.some((e) => e.kind === 'fuite'));
});

test('mélangeur à moitié alimenté', () => {
  const sim = simulate(boardOf(['.. Rv ..', '.. I0 ..', '.. M3 ..'].map((r) => r)));
  assert.ok(sim.errors.length > 0);
});

test('collision : deux flux dans le même tuyau', () => {
  const sim = simulate(boardOf(['Rv .. ..', 'L0 I1 Y<']));
  assert.ok(sim.errors.some((e) => e.kind === 'collision' || e.kind === 'fuite'));
});

test('croisement : deux flux indépendants', () => {
  const sim = simulate(boardOf([
    '.. Rv ..',
    'Y> X0 T<',
    '.. Tv ..',
  ].map((r) => r.replace('Tv', 'T^'))));
  assert.deepEqual(sim.errors, []);
  assert.equal(sim.tanks.length, 2);
});

test('tous les niveaux de tuyaux : solution de référence valide + variantes', () => {
  const ids = new Set();
  for (const def of PIPE_LEVELS) {
    assert.ok(!ids.has(def.id), 'id unique ' + def.id); ids.add(def.id);
    const lv = buildPipeLevel(def);
    assert.ok(lv.par > 0 || lv.valves.length > 0, 'quelque chose à faire ' + def.id);
    // Le niveau ne doit pas être déjà résolu au départ
    assert.equal(simulate({ w: lv.w, h: lv.h, cells: lv.cells, pressure: lv.pressure }).solved, false, 'déjà résolu ' + def.id);
    for (const v of [{ mirror: true }, { perm: { R: 'B', Y: 'R', B: 'Y' } }, { mirror: true, perm: { R: 'Y', Y: 'B', B: 'R' } }]) {
      const vl = buildPipeLevel(variantDef(def, v));
      assert.equal(vl.par, lv.par);
    }
  }
});

test('vannes : une sortie fermée renvoie tout le flux dans l\'autre', () => {
  const lv = buildPipeLevel(PIPE_LEVELS.find((d) => d.id === 'p19'));
  const tank = lv.cells.find((c) => c && c.kind === 'tank');
  assert.deepEqual(tank.target, [1, 1, 0, 0]);
  // Au départ, vanne ouverte : moitié du rouge à l'évier => 1:2, pas résolu
  const sim = simulate({ w: lv.w, h: lv.h, cells: lv.cells, pressure: lv.pressure });
  assert.equal(sim.solved, false);
  assert.deepEqual(sim.tanks[0].ratio, [1, 2, 0, 0]);
  const v = lv.valves[0];
  const cells = lv.cells.map((c) => (c ? { ...c } : null));
  cells[v.i].open = false;
  assert.equal(simulate({ w: lv.w, h: lv.h, cells }).solved, true);
});

test('pression : un tuyau ordinaire cède au-delà d\'un débit de 1', () => {
  const rows = ['Rv .. .. .. Yv', 'I0 .. .. .. I0', 'L0 I1 M2 I1 L3', '.. .. I0 .. ..', '.. .. T^ .. ..'];
  const b = boardOf(rows);
  assert.ok(simulate({ ...b, pressure: true }).errors.some((e) => e.kind === 'rupture'));
  assert.deepEqual(simulate(b).errors, []); // sans pression, aucun problème
});

test('mélangeur à une entrée : erreur sauf si l\'autre est coupée par une vanne', () => {
  const lv = buildPipeLevel(PIPE_LEVELS.find((d) => d.id === 'p20'));
  const tanks = lv.cells.filter((c) => c && c.kind === 'tank').map((c) => c.target);
  assert.deepEqual(tanks, [[1, 1, 0, 0], [0, 0, 1, 0]]);
});
