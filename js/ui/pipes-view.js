// Vue de jeu « Tuyauterie » : grille, inventaire de pièces, simulation en direct.
import { el, toast } from './dom.js';
import { ICON } from './icons.js';
import { chips, swatch, fmtGold } from './widgets.js';
import { mixColor, mixName } from '../core/color.js';
import { PIECES, PIECE_ORDER, openSides, route } from '../pipes/pieces.js';
import { simulate } from '../pipes/sim.js';
import { play, buzz } from '../audio.js';
import { celebrate, centerIn } from './fx.js';

const SIDE_PT = [[50, 0], [100, 50], [50, 100], [0, 50]];
const EMPTY_INNER = '#0b0a12';
export const STEP = 90; // ms pour parcourir une demi-case

// Engrenage (séparateur) : dents autour d'un disque
const GEAR = (() => {
  let d = '';
  const teeth = 10, R = 25, r = 19;
  for (let i = 0; i < teeth * 2; i++) {
    const a1 = (i / (teeth * 2)) * Math.PI * 2, a2 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const rad = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(50 + rad * Math.cos(a1)).toFixed(1)} ${(50 + rad * Math.sin(a1)).toFixed(1)} L${(50 + rad * Math.cos(a2)).toFixed(1)} ${(50 + rad * Math.sin(a2)).toFixed(1)} `;
  }
  return d + 'Z';
})();

/** Bras de tuyau en cuivre vers un côté, avec bride rivetée et liquide néon. */
function arm(side, color, flow, dirOut, delay = null) {
  const lit = color !== EMPTY_INNER;
  const [y1, y2] = dirOut ? [50, 2] : [2, 50];
  // Le liquide « pousse » depuis l'extrémité par laquelle il arrive, avec un délai = temps de trajet.
  const anim = delay != null ? ` grow ${dirOut ? 'o-b' : 'o-t'}" style="animation-delay:${delay}ms` : '';
  const late = delay != null ? ` late" style="animation-delay:${delay + STEP}ms,${delay + STEP}ms` : '';
  return `<g transform="rotate(${side * 90} 50 50)">`
    + '<rect x="34" y="-1" width="32" height="52" fill="url(#g-copper)"/>'
    + `<rect class="pipe-in" x="42" y="0" width="16" height="50" fill="${EMPTY_INNER}"/>`
    + (lit ? `<rect class="pipe-liq${anim}" x="42" y="0" width="16" height="50" fill="${color}" filter="url(#f-glow)"/>` : '')
    + (flow ? `<line class="pipe-f${late}" x1="50" y1="${y1}" x2="50" y2="${y2}"/>` : '')
    + '<rect x="30" y="0" width="40" height="7" fill="url(#g-brass)"/><circle cx="34" cy="3.5" r="1.6" fill="#3a2a0c"/><circle cx="66" cy="3.5" r="1.6" fill="#3a2a0c"/>'
    + '</g>';
}

function arrowAt(side, inward) {
  const d = inward ? 'M43 16 L50 26 L57 16' : 'M43 26 L50 16 L57 26';
  return `<path class="arrow" d="${d}" transform="rotate(${side * 90} 50 50)"/>`;
}

const rivetsRing = (r, n, cls = '#3a2a0c') => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return `<circle cx="${(50 + r * Math.cos(a)).toFixed(1)}" cy="${(50 + r * Math.sin(a)).toFixed(1)}" r="1.8" fill="${cls}"/>`;
}).join('');

/** SVG d'une cellule. flows : Map(side -> { amounts, out:boolean }) */
export function cellSvg(c, flows = new Map(), extra = {}) {
  let body = '';
  if (!c) return '<svg viewBox="0 0 100 100"><path class="circuit" d="M44 50h12M50 44v12"/></svg>';
  const col = (side) => (flows.has(side) ? mixColor(flows.get(side).amounts) : EMPTY_INNER);
  const dl = (side) => flows.get(side)?.delay ?? null;
  const dly = (d) => (d != null ? ` style="animation-delay:${d}ms"` : '');
  // Délai de la première sortie de la pièce (pour les effets au centre)
  const outDelay = [...flows.values()].filter((f) => f.out).map((f) => f.delay).find((d) => d != null) ?? null;
  if (c.kind === 'rock') {
    body = '<rect x="8" y="8" width="84" height="84" fill="url(#g-hazard)" opacity=".85"/>'
      + '<rect x="18" y="18" width="64" height="64" fill="url(#g-steel-r)" stroke="#000" stroke-width="2"/>'
      + '<path d="M28 30 L50 46 L72 30 M50 46 L50 72" stroke="#ff4f6d" stroke-width="2" fill="none" opacity=".7" filter="url(#f-glow)"/>'
      + '<circle cx="24" cy="24" r="2.5" fill="#d6ae5c"/><circle cx="76" cy="24" r="2.5" fill="#d6ae5c"/><circle cx="24" cy="76" r="2.5" fill="#d6ae5c"/><circle cx="76" cy="76" r="2.5" fill="#d6ae5c"/>';
  } else if (c.kind === 'drain') {
    body = '<circle cx="50" cy="50" r="33" fill="url(#g-brass-r)"/><circle cx="50" cy="50" r="26" fill="#050408" stroke="#ffb52e" stroke-width="2" filter="url(#f-glow)"/>'
      + [38, 46, 54, 62].map((y) => `<line x1="32" y1="${y}" x2="68" y2="${y}" stroke="#7a5a22" stroke-width="4" stroke-linecap="round"/>`).join('')
      + rivetsRing(29.5, 8);
  } else if (c.kind === 'src') {
    const cc = mixColor(c.color);
    body = arm(c.dir, cc, true, true, dl(c.dir))
      + '<circle cx="50" cy="50" r="34" fill="url(#g-brass-r)"/>' + rivetsRing(30, 10)
      + '<circle cx="50" cy="50" r="25" fill="#06050a"/>'
      + `<circle cx="50" cy="50" r="18" fill="${cc}" filter="url(#f-glow)"/><circle cx="44" cy="44" r="5" fill="#fff8"/>`;
  } else if (c.kind === 'tank') {
    const got = extra.tank;
    const tc = mixColor(c.target);
    const fill = got?.amounts ? mixColor(got.amounts) : '#06050a';
    const td = extra.tankDelay ?? null;
    body = arm(c.dir, col(c.dir), flows.has(c.dir), false, dl(c.dir))
      + '<circle cx="50" cy="50" r="35" fill="url(#g-brass-r)"/>' + rivetsRing(31.5, 12)
      + '<circle cx="50" cy="50" r="27" fill="#06050a"/>'
      + `<circle cx="50" cy="50" r="23" fill="none" stroke="${tc}" stroke-width="5" filter="url(#f-glow)"/>`
      + `<circle cx="50" cy="50" r="15" fill="#06050a"/>`
      + (got?.amounts ? `<circle class="${td != null ? 'pop' : ''}" cx="50" cy="50" r="15" fill="${fill}" filter="url(#f-glow)"${dly(td)}/>` : '')
      + (got?.amounts && td != null ? `<circle class="tank-wave" cx="50" cy="50" r="18" stroke="${fill}"${dly(td)}/>` : '')
      + (got?.ok ? `<path class="ok${td != null ? ' pop' : ''}" d="M39 51 L47 59 L62 42"${dly(td != null ? td + 200 : null)}/>` : '');
  } else if (c.kind === 'pipe') {
    const P = PIECES[c.type];
    if (P.pairs) {
      P.pairs.forEach(([a, b]) => {
        const ra = (a + c.r) % 4, rb = (b + c.r) % 4;
        for (const sd of [ra, rb]) body += arm(sd, col(sd), flows.has(sd), flows.get(sd)?.out, dl(sd));
      });
      if (c.type === 'X') body += '<rect x="36" y="36" width="28" height="28" rx="4" fill="url(#g-brass-r)"/><circle cx="50" cy="50" r="5" fill="#26f2ff" filter="url(#f-glow)"/>';
      else if (c.type === 'L') {
        const fl = [...flows.values()][0];
        body += `<circle cx="50" cy="50" r="16" fill="url(#g-copper)"/><circle cx="50" cy="50" r="8" fill="${EMPTY_INNER}"/>`
          + (fl ? `<circle class="${outDelay != null ? 'pop' : ''}" cx="50" cy="50" r="8" fill="${mixColor(fl.amounts)}"${dly(outDelay)}/>` : '');
      }
    } else {
      const rt = route(c.type, c.r, (P.ins[0] + c.r) % 4);
      for (const sd of rt.ins) body += arm(sd, col(sd), flows.has(sd), false, dl(sd));
      for (const sd of rt.outs) body += arm(sd, col(sd), flows.has(sd), true, dl(sd));
      const outCol = rt.outs.map(col).find((x) => x !== EMPTY_INNER);
      if (c.type === 'S') {
        body += `<path class="${outDelay != null ? 'gear-turn' : ''}" d="${GEAR}" fill="url(#g-brass-r)" stroke="#3a2a0c" stroke-width="1.5"${dly(outDelay)}/><circle cx="50" cy="50" r="13" fill="#04141a" stroke="#26f2ff" stroke-width="2" filter="url(#f-glow)"/><text x="50" y="56" class="hub-t">½</text>`;
      } else {
        body += '<circle cx="50" cy="50" r="23" fill="url(#g-brass-r)" stroke="#3a2a0c" stroke-width="1.5"/>'
          + [0, 60, 120].map((a) => `<line x1="50" y1="29" x2="50" y2="71" stroke="#5a3f12" stroke-width="3" transform="rotate(${a} 50 50)"/>`).join('')
          + '<circle cx="50" cy="50" r="12" fill="#1a0416" stroke="#ff2fd2" stroke-width="2" filter="url(#f-glow)"/><text x="50" y="56" class="hub-t">+</text>';
        // Réaction : les deux flux se rencontrent, onde de la nouvelle couleur
        if (outDelay != null && outCol) body += `<circle class="hub-burst" cx="50" cy="50" r="14" stroke="${outCol}"${dly(outDelay)}/><circle class="hub-burst" cx="50" cy="50" r="10" stroke="#fff"${dly(outDelay + 120)}/>`;
      }
      for (const sd of rt.ins) body += arrowAt(sd, true);
      for (const sd of rt.outs) body += arrowAt(sd, false);
    }
    if (c.fixed) body += '<circle class="bolt" cx="10" cy="10" r="4"/><circle class="bolt" cx="90" cy="10" r="4"/><circle class="bolt" cx="10" cy="90" r="4"/><circle class="bolt" cx="90" cy="90" r="4"/>';
  }
  for (const e of extra.errors || []) {
    if (e.side != null) {
      const [x, y] = SIDE_PT[e.side];
      const cx = (x + 50) / 2 + (x - 50) * 0.42, cy = (y + 50) / 2 + (y - 50) * 0.42;
      const ld = flows.get(e.side)?.delay;
      body += `<path class="leak${ld != null ? ' late' : ''}"${ld != null ? ` style="animation-delay:${ld + STEP}ms,${ld + STEP}ms"` : ''} d="M${cx} ${cy - 9} C${cx + 7} ${cy - 1} ${cx + 6} ${cy + 7} ${cx} ${cy + 7} C${cx - 6} ${cy + 7} ${cx - 7} ${cy - 1} ${cx} ${cy - 9}Z"/>`;
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
  let prevKeys = new Set();
  let legendTimer = null;

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
    <div class="layer"></div>
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
    // Seuls les segments nouveaux (ou dont la couleur change) sont animés, à partir du point modifié.
    const keyOf = (sg) => `${sg.idx}:${sg.side}:${mixColor(sg.amounts)}`;
    const fresh = sim.segments.filter((sg) => !prevKeys.has(keyOf(sg)));
    const t0 = fresh.length ? Math.min(...fresh.map((sg) => sg.t)) : 0;
    let animEnd = 0;
    for (const sg of sim.segments) {
      if (!flows.has(sg.idx)) flows.set(sg.idx, new Map());
      const m = flows.get(sg.idx);
      const delay = prevKeys.has(keyOf(sg)) ? null : (sg.t - t0) * STEP;
      if (delay != null) animEnd = Math.max(animEnd, delay + STEP);
      if (!m.has(sg.side)) m.set(sg.side, { amounts: sg.amounts, out: sg.out, delay });
    }
    prevKeys = new Set(sim.segments.map(keyOf));
    const tankDelay = (t) => (flows.get(t.idx)?.get(cells[t.idx].dir)?.delay != null ? (t.t - t0) * STEP : null);
    const errBy = new Map();
    for (const e of sim.errors) { if (!errBy.has(e.idx)) errBy.set(e.idx, []); errBy.get(e.idx).push(e); }
    const tankBy = new Map(sim.tanks.map((t) => [t.idx, t]));
    grid.querySelectorAll('.cell').forEach((ce, i) => {
      const c = cells[i];
      const showGhost = ghost && ghost.i === i && !c;
      ce.innerHTML = showGhost ? cellSvg({ kind: 'pipe', type: ghost.type, r: ghost.r }) : cellSvg(c, flows.get(i), { errors: errBy.get(i), tank: tankBy.get(i), tankDelay: tankBy.has(i) ? tankDelay(tankBy.get(i)) : null });
      ce.dataset.type = c?.type || '';
      ce.dataset.r = c?.r ?? '';
      ce.className = 'cell' + (c ? ' k-' + c.kind : ' empty') + (c?.fixed ? ' fixed' : '') + (errBy.has(i) ? ' err' : '') + (showGhost ? ' ghost' : '') + (ghost?.i === i && c ? ' hinted' : '');
    });
    // Légende des cuves : mise à jour quand le liquide est arrivé
    clearTimeout(legendTimer);
    const legendHtml = sim.tanks.map((t, k) => {
      const target = cells[t.idx].target;
      return `<div class="tl ${t.ok ? 'ok' : ''}"><span class="tl-n">Cuve ${k + 1}</span>${swatch(target, 20)}${chips(target, { compact: true })}
        <span class="tl-arrow">←</span>${t.ratio ? chips(t.ratio, { compact: true }) : '<em>vide</em>'}${t.ok ? ICON.check : ''}</div>`;
    }).join('');
    if (animEnd > 0) legendTimer = setTimeout(() => { $('.tanks-legend').innerHTML = legendHtml; }, animEnd);
    else $('.tanks-legend').innerHTML = legendHtml;
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
    if (fresh.length && animEnd > STEP * 2) play('flow');
    if (sim.solved && !finished) win(animEnd, sim);
  }

  function cost() {
    if (!opts.pieceCost) return 0;
    return cells.reduce((a, c) => a + (c && c.kind === 'pipe' && !c.fixed ? opts.pieceCost(c.type) : 0), 0);
  }

  function snapshot() { history.push({ cells: cells.map((c) => (c ? { ...c } : null)), inv: { ...inv } }); if (history.length > 200) history.shift(); }

  function win(after, sim) {
    finished = true; // verrouille la grille pendant que le liquide finit de couler
    const pieces = placed();
    let stars = pieces <= lv.par ? 3 : pieces <= lv.par + 2 ? 2 : 1;
    if (hintUsed) stars = Math.min(2, stars);
    setTimeout(() => {
      play('win'); buzz([30, 60, 30]);
      view.classList.add('won');
      // Onde d'énergie qui parcourt le réseau, puis gerbes d'étincelles sur les cuves
      grid.querySelectorAll('.cell.k-pipe, .cell.k-src, .cell.k-tank').forEach((ce) => {
        const i = +ce.dataset.cell;
        ce.style.animationDelay = ((i % W) + Math.floor(i / W)) * 45 + 'ms';
        ce.classList.add('surge');
      });
      const layer = $('.layer');
      const pts = sim.tanks.map((t) => centerIn(grid.children[t.idx], view));
      celebrate(layer, pts, sim.tanks.map((t) => mixColor(t.amounts)).concat(['#26f2ff', '#ff2fd2', '#f0cf7e']));
    }, after + 150);
    setTimeout(() => opts.onWin({ pieces, stars, cost: cost(), hintUsed }), after + 1500);
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
      if (tool === 'erase') { cells[i] = null; inv[c.type]++; play('remove'); }
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
    play('remove'); buzz(15); render();
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
  return { el: view, destroy() { ro.disconnect(); clearTimeout(pressTimer); clearTimeout(legendTimer); view.remove(); } };
}
