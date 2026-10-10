// Vue de jeu « Tuyauterie » : grille, inventaire de pièces, simulation en direct.
import { el, toast } from './dom.js';
import { ICON } from './icons.js';
import { chips, swatch, fmtGold } from './widgets.js';
import { mixColor, mixName } from '../core/color.js';
import { PIECES, PIECE_ORDER, openSides, route } from '../pipes/pieces.js';
import { simulate } from '../pipes/sim.js';
import { play, buzz } from '../audio.js';

const SIDE_PT = [[50, 0], [100, 50], [50, 100], [0, 50]];
const EMPTY_INNER = '#17131f';

function arm(side, color, flow, dirOut) {
  const [x, y] = SIDE_PT[side];
  // Le trait est orienté dans le sens du flux pour animer les pointillés.
  const [x1, y1, x2, y2] = dirOut ? [50, 50, x, y] : [x, y, 50, 50];
  return `<line class="pipe-o" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`
    + `<line class="pipe-i" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}"/>`
    + (flow ? `<line class="pipe-f" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>` : '');
}

function arrowAt(side, inward) {
  // Petite flèche sur le bras : vers le centre (entrée) ou vers l'extérieur (sortie)
  const d = inward ? 'M43 18 L50 28 L57 18' : 'M43 28 L50 18 L57 28';
  return `<path class="arrow" d="${d}" transform="rotate(${side * 90} 50 50)"/>`;
}

/** SVG d'une cellule. flows : Map(side -> { amounts, out:boolean }) */
export function cellSvg(c, flows = new Map(), extra = {}) {
  let body = '';
  if (!c) return `<svg viewBox="0 0 100 100"><circle class="dot" cx="50" cy="50" r="3"/></svg>`;
  const col = (side) => (flows.has(side) ? mixColor(flows.get(side).amounts) : EMPTY_INNER);
  if (c.kind === 'rock') {
    body = '<path class="rock" d="M18 70 L28 34 L52 22 L76 32 L84 62 L66 82 L34 84 Z"/><path class="rock-l" d="M28 34 L48 50 L76 32 M48 50 L50 82"/>';
  } else if (c.kind === 'drain') {
    body = '<circle class="drain" cx="50" cy="50" r="30"/>' + [36, 46, 56, 64].map((y) => `<line class="grate" x1="${30}" y1="${y}" x2="70" y2="${y}"/>`).join('');
  } else if (c.kind === 'src') {
    body = arm(c.dir, mixColor(c.color), true, true) + `<circle class="src-ring" cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="23" fill="${mixColor(c.color)}"/>`;
  } else if (c.kind === 'tank') {
    const got = extra.tank;
    const fill = got?.amounts ? mixColor(got.amounts) : 'transparent';
    body = arm(c.dir, col(c.dir), flows.has(c.dir), false)
      + `<rect class="tank" x="22" y="22" width="56" height="56" rx="12"/>`
      + `<rect x="30" y="30" width="40" height="40" rx="8" fill="${fill}"/>`
      + `<rect x="22" y="22" width="56" height="56" rx="12" fill="none" stroke="${mixColor(c.target)}" stroke-width="7"/>`
      + (got?.ok ? '<path class="ok" d="M36 51 L46 61 L65 40"/>' : '');
  } else if (c.kind === 'pipe') {
    const P = PIECES[c.type];
    if (P.pairs) {
      P.pairs.forEach(([a, b]) => {
        const ra = (a + c.r) % 4, rb = (b + c.r) % 4;
        for (const sd of [ra, rb]) body += arm(sd, col(sd), flows.has(sd), flows.get(sd)?.out);
      });
      if (c.type === 'X') body += '<circle class="hub" cx="50" cy="50" r="9"/>';
    } else {
      const rt = route(c.type, c.r, (P.ins[0] + c.r) % 4);
      for (const sd of rt.ins) body += arm(sd, col(sd), flows.has(sd), false);
      for (const sd of rt.outs) body += arm(sd, col(sd), flows.has(sd), true);
      body += `<circle class="hub ${c.type === 'S' ? 'split' : 'mix'}" cx="50" cy="50" r="17"/>`;
      body += c.type === 'S' ? '<text x="50" y="57" class="hub-t">½</text>' : '<text x="50" y="58" class="hub-t">+</text>';
      for (const sd of rt.ins) body += arrowAt(sd, true);
      for (const sd of rt.outs) body += arrowAt(sd, false);
    }
    if (c.fixed) body += '<circle class="bolt" cx="12" cy="12" r="4"/><circle class="bolt" cx="88" cy="12" r="4"/><circle class="bolt" cx="12" cy="88" r="4"/><circle class="bolt" cx="88" cy="88" r="4"/>';
  }
  for (const e of extra.errors || []) {
    if (e.side != null) {
      const [x, y] = SIDE_PT[e.side];
      body += `<circle class="leak" cx="${(x + 50) / 2 + (x - 50) * 0.35}" cy="${(y + 50) / 2 + (y - 50) * 0.35}" r="9"/>`;
    }
  }
  return `<svg viewBox="0 0 100 100">${body}</svg>`;
}

export function pieceIcon(type, r = 0) {
  return cellSvg({ kind: 'pipe', type, r });
}

/**
 * opts : { level, title, subtitle, tip, pieceCost(type) | null, hints | null, onExit(), onWin({ pieces, stars, cost, hintUsed }) }
 */
export function PipesView(root, opts) {
  const lv = opts.level;
  const W = lv.w, H = lv.h;
  let cells = lv.cells.map((c) => (c ? { ...c } : null));
  let inv = { ...lv.inventory };
  let history = [];
  let tool = PIECE_ORDER.find((t) => inv[t] > 0) || null;
  const lastRot = {};
  let hintUsed = false, finished = false, ghost = null;

  const view = el(`<div class="screen game pipes">
    <header class="bar">
      <button class="icon-btn" data-act="back" aria-label="Retour">${ICON.back}</button>
      <div class="bar-title"><strong>${opts.title}</strong><small>${opts.subtitle || ''}</small></div>
      <button class="icon-btn" data-act="hint" aria-label="Indice">${ICON.hint}<span class="badge" hidden></span></button>
      <button class="icon-btn" data-act="undo" aria-label="Annuler">${ICON.undo}</button>
      <button class="icon-btn" data-act="restart" aria-label="Tout retirer">${ICON.restart}</button>
    </header>
    <div class="status"><span class="moves"></span><span class="msg"></span></div>
    <section class="tanks-legend"></section>
    <section class="grid-wrap"><div class="grid" style="--w:${W};--h:${H}"></div></section>
    <section class="inventory"></section>
  </div>`);
  root.appendChild(view);
  const $ = (q) => view.querySelector(q);
  const grid = $('.grid');
  for (let i = 0; i < W * H; i++) grid.appendChild(el(`<button class="cell" data-cell="${i}" aria-label="Case ${(i % W) + 1},${Math.floor(i / W) + 1}"></button>`));

  const invEl = $('.inventory');
  for (const t of PIECE_ORDER) {
    if (!lv.inventory[t]) continue;
    invEl.appendChild(el(`<button class="inv" data-tool="${t}" aria-label="${PIECES[t].name}">${pieceIcon(t)}<span class="inv-n"></span><small>${PIECES[t].name}</small></button>`));
  }
  invEl.appendChild(el(`<button class="inv erase" data-tool="erase" aria-label="Retirer">${ICON.erase}<small>Retirer</small></button>`));

  if (opts.tip) {
    const tip = el(`<div class="tip-bubble">${opts.tip}<button class="tip-close" aria-label="Fermer">${ICON.close}</button></div>`);
    tip.querySelector('.tip-close').onclick = () => tip.remove();
    view.querySelector('.tanks-legend').after(tip);
  }

  function sizeGrid() {
    const wrap = $('.grid-wrap');
    // Marges : padding (2×4), bordure (2×1) et espacements (2 px) de la grille.
    const s = Math.floor(Math.min((wrap.clientWidth - 26 - 2 * (W - 1)) / W, (wrap.clientHeight - 14 - 2 * (H - 1)) / H, 84));
    grid.style.setProperty('--cell', Math.max(34, s) + 'px');
  }

  const placed = () => cells.filter((c) => c && c.kind === 'pipe' && !c.fixed).length;

  function render() {
    const sim = simulate({ w: W, h: H, cells });
    const flows = new Map();
    for (const sg of sim.segments) {
      if (!flows.has(sg.idx)) flows.set(sg.idx, new Map());
      const m = flows.get(sg.idx);
      if (!m.has(sg.side)) m.set(sg.side, { amounts: sg.amounts, out: sg.out });
    }
    const errBy = new Map();
    for (const e of sim.errors) { if (!errBy.has(e.idx)) errBy.set(e.idx, []); errBy.get(e.idx).push(e); }
    const tankBy = new Map(sim.tanks.map((t) => [t.idx, t]));
    grid.querySelectorAll('.cell').forEach((ce, i) => {
      const c = cells[i];
      const showGhost = ghost && ghost.i === i && !c;
      ce.innerHTML = showGhost ? cellSvg({ kind: 'pipe', type: ghost.type, r: ghost.r }) : cellSvg(c, flows.get(i), { errors: errBy.get(i), tank: tankBy.get(i) });
      ce.dataset.type = c?.type || '';
      ce.dataset.r = c?.r ?? '';
      ce.className = 'cell' + (c ? ' k-' + c.kind : ' empty') + (c?.fixed ? ' fixed' : '') + (errBy.has(i) ? ' err' : '') + (showGhost ? ' ghost' : '') + (ghost?.i === i && c ? ' hinted' : '');
    });
    // Légende des cuves
    $('.tanks-legend').innerHTML = sim.tanks.map((t, k) => {
      const target = cells[t.idx].target;
      return `<div class="tl ${t.ok ? 'ok' : ''}"><span class="tl-n">Cuve ${k + 1}</span>${swatch(target, 20)}${chips(target, { compact: true })}
        <span class="tl-arrow">←</span>${t.ratio ? chips(t.ratio, { compact: true }) : '<em>vide</em>'}${t.ok ? ICON.check : ''}</div>`;
    }).join('');
    // Inventaire
    invEl.querySelectorAll('.inv').forEach((b) => {
      const t = b.dataset.tool;
      b.classList.toggle('active', tool === t);
      if (t !== 'erase') {
        b.querySelector('.inv-n').textContent = inv[t];
        b.disabled = inv[t] <= 0 && tool !== t;
      }
    });
    $('.moves').innerHTML = `Pièces : <b>${placed()}</b> · Réf. : ${lv.par}` + (opts.pieceCost ? ` · Coût : <b>${fmtGold(cost())}</b> or` : '');
    const kinds = new Set(sim.errors.map((e) => e.kind));
    const leaks = sim.errors.filter((e) => e.kind === 'fuite').length;
    let msg = '';
    if (kinds.has('collision')) msg = 'Deux flux se percutent !';
    else if (kinds.has('mélangeur')) msg = 'Un mélangeur attend son 2ᵉ flux.';
    else if (leaks) msg = `${leaks} fuite${leaks > 1 ? 's' : ''}`;
    else if (!sim.solved) msg = 'Proportions à ajuster';
    $('.msg').textContent = msg;
    $('.msg').className = 'msg' + (msg ? ' bad' : '');
    $('[data-act="undo"]').disabled = !history.length || finished;
    const hb = $('[data-act="hint"] .badge');
    if (opts.hints) { hb.hidden = false; hb.textContent = opts.hints.get(); }
    if (sim.solved && !finished) win();
  }

  function cost() {
    if (!opts.pieceCost) return 0;
    return cells.reduce((a, c) => a + (c && c.kind === 'pipe' && !c.fixed ? opts.pieceCost(c.type) : 0), 0);
  }

  function snapshot() { history.push({ cells: cells.map((c) => (c ? { ...c } : null)), inv: { ...inv } }); if (history.length > 200) history.shift(); }

  function win() {
    finished = true;
    const pieces = placed();
    let stars = pieces <= lv.par ? 3 : pieces <= lv.par + 2 ? 2 : 1;
    if (hintUsed) stars = Math.min(2, stars);
    play('win'); buzz([30, 60, 30]);
    view.classList.add('won');
    setTimeout(() => opts.onWin({ pieces, stars, cost: cost(), hintUsed }), 1100);
  }

  let pressTimer = null, longPressed = false;
  function tapCell(i) {
    const c = cells[i];
    ghost = null;
    if (!c) {
      if (!tool || tool === 'erase') { toast('Choisis une pièce dans l\'inventaire.'); return; }
      if (inv[tool] <= 0) { toast('Plus de pièces de ce type.', 'warn'); play('error'); return; }
      snapshot();
      cells[i] = { kind: 'pipe', type: tool, r: lastRot[tool] || 0 };
      inv[tool]--;
      play('place'); buzz(8);
      if (inv[tool] <= 0) tool = PIECE_ORDER.find((t) => inv[t] > 0) || tool;
    } else if (c.kind === 'pipe' && !c.fixed) {
      snapshot();
      if (tool === 'erase') { cells[i] = null; inv[c.type]++; play('rotate'); }
      else {
        c.r = (c.r + 1) % PIECES[c.type].rotations;
        lastRot[c.type] = c.r;
        play('rotate');
      }
    } else {
      const d = { src: 'Source : débit 1, toujours ouverte.', tank: `Cuve : attend ${mixName(c.target)} (${c.target.filter(Boolean).join(':')}).`, drain: 'Évier : accepte tout ce qui arrive.', rock: 'Un roc : impossible de construire ici.', pipe: 'Pièce fixe : elle ne bouge pas.' };
      toast(d[c.kind] || '');
      return;
    }
    render();
  }

  function removeAt(i) {
    const c = cells[i];
    if (!c || c.kind !== 'pipe' || c.fixed) return;
    snapshot();
    cells[i] = null; inv[c.type]++;
    play('rotate'); buzz(15); render();
  }

  grid.addEventListener('pointerdown', (e) => {
    const ce = e.target.closest('[data-cell]');
    if (!ce || finished) return;
    longPressed = false;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { longPressed = true; removeAt(+ce.dataset.cell); }, 480);
  });
  const cancelPress = () => clearTimeout(pressTimer);
  grid.addEventListener('pointerup', cancelPress);
  grid.addEventListener('pointerleave', cancelPress);
  grid.addEventListener('pointercancel', cancelPress);
  grid.addEventListener('contextmenu', (e) => e.preventDefault());

  view.addEventListener('click', (e) => {
    if (finished) return;
    const ce = e.target.closest('[data-cell]');
    if (ce) { if (!longPressed) tapCell(+ce.dataset.cell); longPressed = false; return; }
    const tb = e.target.closest('[data-tool]');
    if (tb) {
      const t = tb.dataset.tool;
      tool = tool === t ? null : t;
      play('select'); render(); return;
    }
    const ab = e.target.closest('[data-act]');
    if (ab) action(ab.dataset.act);
  });

  function hint() {
    if (opts.hints && opts.hints.get() <= 0) { toast('Plus d\'indices : achète-en à l\'atelier.', 'warn'); return; }
    // Une pièce mal placée sur une case de la solution ? Sinon, montrer une pièce manquante.
    const sol = lv.solution;
    const wrong = sol.find((p) => cells[p.i] && cells[p.i].kind === 'pipe' && !cells[p.i].fixed
      && (cells[p.i].type !== p.type || !sameShape(cells[p.i], p)));
    const missing = sol.find((p) => !cells[p.i]);
    const stray = cells.findIndex((c, i) => c && c.kind === 'pipe' && !c.fixed && !sol.some((p) => p.i === i));
    let m;
    if (wrong) { ghost = { i: wrong.i }; m = 'Cette pièce n\'est pas la bonne (ou mal orientée).'; }
    else if (missing) { ghost = { ...missing }; m = `Pose ici : ${PIECES[missing.type].name}, comme indiqué.`; }
    else if (stray >= 0) { ghost = { i: stray }; m = 'Cette pièce est superflue.'; }
    else { toast('Tout est en place !'); return; }
    if (opts.hints) opts.hints.use();
    hintUsed = true; toast(m); render();
  }
  const sameShape = (c, p) => {
    if (c.type !== p.type) return false;
    const a = openSides(c.type, c.r).sort().join(), b = openSides(p.type, p.r).sort().join();
    return c.type === 'S' || c.type === 'M' ? c.r === p.r : a === b;
  };

  function action(a) {
    if (a === 'back') return opts.onExit();
    if (a === 'undo' && history.length) { const h = history.pop(); cells = h.cells; inv = h.inv; ghost = null; play('select'); render(); }
    if (a === 'restart') {
      if (!placed()) return;
      snapshot();
      cells = lv.cells.map((c) => (c ? { ...c } : null)); inv = { ...lv.inventory }; ghost = null; render();
    }
    if (a === 'hint') hint();
  }

  const ro = new ResizeObserver(sizeGrid);
  ro.observe($('.grid-wrap'));
  sizeGrid();
  render();
  return { el: view, destroy() { ro.disconnect(); clearTimeout(pressTimer); view.remove(); } };
}
