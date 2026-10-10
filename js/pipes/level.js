// Format des niveaux de tuyauterie : la carte est la SOLUTION de référence, écrite en jetons de 2 caractères.
//   ..  vide            ##  roc             D*  évier
//   R^ Y> Bv W<         source (couleur + sens de sortie)
//   T^ T> Tv T<         cuve (côté d'entrée) — la proportion cible est calculée depuis la solution
//   I0 L2 X0 S1 M3 H0 J1  pièce du joueur (H/J = renforcés) — retirée de la carte, ajoutée à l'inventaire
//   i0 l2 x0 s1 m3 h0 j1  pièce fixe pré-posée (minuscule)
//   O0 O1 / C0 C1         vanne (axe 0 vertical, 1 horizontal) ouverte / fermée DANS LA SOLUTION
import { simulate } from './sim.js';

const ARROW = { '^': 0, '>': 1, v: 2, '<': 3 };
const COLOR = { R: [1, 0, 0, 0], Y: [0, 1, 0, 0], B: [0, 0, 1, 0], W: [0, 0, 0, 1] };

export function parseMap(rows) {
  const grid = rows.map((r) => r.trim().split(/\s+/));
  const h = grid.length, w = grid[0].length;
  const cells = new Array(w * h).fill(null);
  const solution = [];
  const valves = [];
  grid.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Ligne ${y} : ${row.length} colonnes au lieu de ${w}`);
    row.forEach((tok, x) => {
      const i = y * w + x;
      const a = tok[0], b = tok[1];
      if (tok === '..') return;
      if (tok === '##') cells[i] = { kind: 'rock' };
      else if (tok === 'D*') cells[i] = { kind: 'drain' };
      else if (COLOR[a] && b in ARROW) cells[i] = { kind: 'src', color: COLOR[a].slice(), dir: ARROW[b] };
      else if (a === 'T' && b in ARROW) cells[i] = { kind: 'tank', dir: ARROW[b], target: null };
      else if ((a === 'O' || a === 'C') && (b === '0' || b === '1')) { cells[i] = { kind: 'valve', axis: +b, open: true }; valves.push({ i, open: a === 'O' }); }
      else if ('ILXSMHJ'.includes(a)) solution.push({ i, type: a, r: +b });
      else if ('ilxsmhj'.includes(a)) cells[i] = { kind: 'pipe', type: a.toUpperCase(), r: +b, fixed: true };
      else throw new Error(`Jeton inconnu « ${tok} »`);
    });
  });
  return { w, h, cells, solution, valves };
}

/** Construit un niveau jouable depuis sa définition ; vérifie que la solution fonctionne. */
export function buildPipeLevel(def) {
  const { w, h, cells, solution, valves } = parseMap(def.map);
  const pressure = !!def.pressure;
  const solved = cells.map((c) => (c ? { ...c } : null));
  for (const p of solution) solved[p.i] = { kind: 'pipe', type: p.type, r: p.r };
  for (const v of valves) solved[v.i].open = v.open;
  const sim = simulate({ w, h, cells: solved, pressure });
  if (sim.errors.length) throw new Error(`Solution invalide (${def.id}) : ${JSON.stringify(sim.errors.slice(0, 3))}`);
  for (const t of sim.tanks) {
    if (!t.ratio) throw new Error(`Cuve vide dans la solution (${def.id})`);
    cells[t.idx] = { ...cells[t.idx], target: t.ratio };
  }
  // Les vannes démarrent toutes ouvertes (ou fermées si def.valvesStart === 'closed').
  for (const v of valves) cells[v.i].open = def.valvesStart !== 'closed';
  const inventory = { I: 0, L: 0, H: 0, J: 0, X: 0, S: 0, M: 0 };
  for (const p of solution) inventory[p.type]++;
  for (const [k, v] of Object.entries(def.extra || {})) inventory[k] += v;
  return {
    id: def.id, name: def.name, tip: def.tip || '', w, h, cells, inventory, pressure,
    par: solution.length, solution, valves,
  };
}

/** Variante : miroir horizontal et/ou permutation des couleurs primaires (préserve la solvabilité). */
export function variantDef(def, { mirror = false, perm = null } = {}) {
  const flipTok = (tok) => {
    if (tok === '..' || tok === '##' || tok === 'D*') return tok;
    const a = tok[0], b = tok[1];
    if (b in ARROW) {
      const nb = { '>': '<', '<': '>', '^': '^', v: 'v' }[b];
      return a + nb;
    }
    const t = a.toUpperCase(), r = +b;
    let nr = r;
    if ('IHXOC'.includes(t)) nr = r;                      // droits, croisements, vannes : symétriques
    else if (t === 'L' || t === 'J') nr = [3, 2, 1, 0][r]; // N-E <-> N-O ...
    else if (t === 'S' || t === 'M') nr = [0, 3, 2, 1][r]; // axe vertical conservé
    return a + nr;
  };
  const recolor = (tok) => (perm && 'RYB'.includes(tok[0]) && tok[1] in ARROW ? perm[tok[0]] + tok[1] : tok);
  const map = def.map.map((row) => {
    let toks = row.trim().split(/\s+/).map(recolor);
    if (mirror) toks = toks.reverse().map(flipTok);
    return toks.join(' ');
  });
  return { ...def, map };
}
