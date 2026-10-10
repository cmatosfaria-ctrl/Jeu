// Vue de jeu « Dosage » : fioles, sources, évier, commandes.
import { el, toast } from './dom.js';
import { ICON } from './icons.js';
import { chips, swatch, fmtGold } from './widgets.js';
import { mixColor, mixName, toRatio } from '../core/color.js';
import { initialState, applyMove, checkMove, isWon, starsFor, sourceFracs, moveCost } from '../dosage/engine.js';
import { solve } from '../dosage/solver.js';
import { play, buzz } from '../audio.js';
import { doseCost } from '../career/career.js';

/**
 * opts : { level, title, subtitle, tip, prices (carrière), hints: { get(), use() } | null,
 *          onExit(), onWin({ moves, stars, cost, hintUsed }) }
 */
export function DosageView(root, opts) {
  const lv = opts.level;
  const srcFracs = lv.sources.map(sourceFracs);
  let history = [{ state: initialState(lv), move: null, cost: 0 }];
  let sel = null; // { k: 'flask'|'source', i }
  let busy = false, hintUsed = false, finished = false;
  const cur = () => history[history.length - 1];
  const movesCount = () => history.reduce((a, h) => a + (h.move ? moveCost(h.move) : 0), 0);
  const maxCap = Math.max(...lv.caps);

  const view = el(`<div class="screen game dosage">
    <header class="bar">
      <button class="icon-btn" data-act="back" aria-label="Retour">${ICON.back}</button>
      <div class="bar-title"><strong>${opts.title}</strong><small>${opts.subtitle || ''}</small></div>
      <button class="icon-btn" data-act="hint" aria-label="Indice">${ICON.hint}<span class="badge" hidden></span></button>
      <button class="icon-btn" data-act="undo" aria-label="Annuler">${ICON.undo}</button>
      <button class="icon-btn" data-act="restart" aria-label="Recommencer">${ICON.restart}</button>
    </header>
    <div class="status"><span class="moves"></span><span class="cost"></span></div>
    <section class="orders" aria-label="Commandes"></section>
    <section class="bench" aria-label="Fioles"></section>
    <section class="supplies" aria-label="Sources"></section>
    <div class="layer"></div>
  </div>`);
  root.appendChild(view);
  const $ = (q) => view.querySelector(q);

  // ----- Construction -----
  const ordersEl = $('.orders');
  lv.orders.forEach((o, i) => {
    ordersEl.appendChild(el(`<button class="order" data-order="${i}">
      ${swatch(o.ratio, 34)}
      <span class="order-txt"><b>${o.vol} dose${o.vol > 1 ? 's' : ''}</b><small>${mixName(o.ratio)}</small>${chips(o.ratio)}</span>
      <span class="order-done">${ICON.check}</span>
    </button>`));
  });

  const bench = $('.bench');
  const unitPx = () => {
    const h = bench.clientHeight || 260;
    // Plusieurs rangées si beaucoup de fioles : la hauteur disponible se partage.
    const rows = lv.caps.length > 4 ? 2 : 1;
    return Math.max(12, Math.min(60, Math.floor((h / rows - 84) / maxCap)));
  };
  lv.caps.forEach((cap, i) => {
    bench.appendChild(el(`<button class="flask" data-flask="${i}" aria-label="Fiole ${i + 1}, capacité ${cap}">
      <span class="glass"><span class="liquid"></span><span class="ticks"></span><span class="shine"></span></span>
      <span class="flabel"></span><span class="fchips"></span>
    </button>`));
  });

  const sup = $('.supplies');
  lv.sources.forEach((s, i) => {
    const pure = s.comp.filter((v) => v > 0).length === 1;
    sup.appendChild(el(`<button class="source" data-source="${i}" aria-label="Source ${mixName(s.comp)}">
      <span class="jar" style="--c:${mixColor(s.comp)}"><span class="jar-liquid"></span></span>
      <span class="slabel">${pure ? mixName(s.comp) : chips(s.comp, { compact: true })}</span>
      <span class="stock"></span>
    </button>`));
  });
  sup.appendChild(el(`<button class="sink" data-sink="1" aria-label="Évier">${ICON.sink}<span class="slabel">Évier</span></button>`));

  if (opts.tip) {
    const tip = el(`<div class="tip-bubble">${opts.tip}<button class="tip-close" aria-label="Fermer">${ICON.close}</button></div>`);
    tip.querySelector('.tip-close').onclick = () => tip.remove();
    view.querySelector('.orders').after(tip);
  }

  function sizeFlasks() {
    const u = unitPx();
    const fw = Math.max(44, Math.min(70, Math.floor((bench.clientWidth - 40) / Math.min(4, lv.caps.length)) - 30));
    view.querySelectorAll('.flask').forEach((f, i) => {
      f.style.setProperty('--fw', fw + 'px');
      const g = f.querySelector('.glass');
      g.style.height = lv.caps[i] * u + 'px';
      g.style.setProperty('--unit', u + 'px');
    });
  }

  // ----- Mise à jour de l'affichage -----
  function update() {
    const s = cur().state;
    s.flasks.forEach((f, i) => {
      const fe = view.querySelector(`[data-flask="${i}"]`);
      const liq = fe.querySelector('.liquid');
      liq.style.height = (f.vol / f.cap) * 100 + '%';
      if (f.vol) { const lc = mixColor(f.amt); liq.style.background = lc; liq.style.setProperty('--lc', lc); }
      fe.querySelector('.flabel').textContent = `${f.vol}/${f.cap}`;
      fe.querySelector('.fchips').innerHTML = f.vol ? chips(toRatio(f.amt), { compact: true }) : '';
      fe.classList.toggle('selected', sel?.k === 'flask' && sel.i === i);
      fe.classList.toggle('full', f.vol === f.cap);
    });
    lv.sources.forEach((src, i) => {
      const se = view.querySelector(`[data-source="${i}"]`);
      const st = s.stock[i];
      se.querySelector('.stock').textContent = st < 0 ? '' : `reste ${st}`;
      se.classList.toggle('empty', st === 0);
      se.classList.toggle('selected', sel?.k === 'source' && sel.i === i);
    });
    lv.orders.forEach((o, i) => view.querySelector(`[data-order="${i}"]`).classList.toggle('done', s.done[i]));
    const mv = movesCount();
    $('.moves').innerHTML = `Coups : <b>${mv}</b> · Optimum : ${lv.par}`;
    const cost = history.reduce((a, h) => a + h.cost, 0);
    $('.cost').innerHTML = opts.prices ? `Pigments : <b>${fmtGold(cost)}</b> or` : '';
    $('[data-act="undo"]').disabled = history.length < 2 || finished;
    const hb = $('[data-act="hint"] .badge');
    if (opts.hints) { hb.hidden = false; hb.textContent = opts.hints.get(); }
  }

  // ----- Animations -----
  function center(elm) {
    const r = elm.getBoundingClientRect(), v = view.getBoundingClientRect();
    return { x: r.left - v.left + r.width / 2, y: r.top - v.top, w: r.width, h: r.height };
  }
  function stream(fromEl, toEl, color, dur = 520) {
    const a = center(fromEl), b = center(toEl);
    const layer = $('.layer');
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const st = el(`<div class="stream" style="left:${a.x}px;top:${a.y}px;width:${len}px;background:${color};color:${color};transform:rotate(${ang}deg)"></div>`);
    layer.appendChild(st);
    st.animate([{ clipPath: 'inset(0 100% 0 0)', opacity: 1 }, { clipPath: 'inset(0 0 0 0)', opacity: 1, offset: 0.4 }, { clipPath: 'inset(0 0 0 100%)', opacity: 0.6 }],
      { duration: dur, easing: 'ease-in-out' }).onfinish = () => st.remove();
  }
  function tilt(fe, toward) {
    const a = center(fe), b = center(toward);
    const dir = b.x >= a.x ? 1 : -1;
    const tx = (b.x - a.x) * 0.55, ty = Math.min(-30, b.y - a.y - 50);
    return fe.animate([
      { transform: 'translate(0,0) rotate(0)' },
      { transform: `translate(${tx}px,${ty}px) rotate(${dir * 55}deg)`, offset: 0.35 },
      { transform: `translate(${tx}px,${ty}px) rotate(${dir * 70}deg)`, offset: 0.7 },
      { transform: 'translate(0,0) rotate(0)' },
    ], { duration: 820, easing: 'ease-in-out' });
  }
  function shake(e) { e.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 240 }); }

  // ----- Coups -----
  function doMove(m) {
    const s = cur().state;
    if (m.t === 'pour' && m.a === m.b) { sel = null; update(); return; }
    const err = checkMove(lv, s, m);
    if (err) {
      toast(err, 'warn'); play('error'); buzz(40);
      const t = m.t === 'deliver' ? view.querySelector(`[data-order="${m.o}"]`) : view.querySelector(`[data-flask="${m.f ?? m.b}"]`);
      if (t) shake(t);
      sel = null; update();
      return;
    }
    const before = s;
    const { state, drawn } = applyMove(lv, s, m, srcFracs);
    let cost = 0;
    if (m.t === 'fill' && opts.prices) cost = doseCost(opts.prices, lv.sources[m.s].comp, drawn);
    history.push({ state, move: m, cost });
    sel = null;
    busy = true;
    let delay = 0;
    if (m.t === 'pour') {
      const fa = view.querySelector(`[data-flask="${m.a}"]`), fb = view.querySelector(`[data-flask="${m.b}"]`);
      tilt(fa, fb);
      setTimeout(() => stream(fa, fb, mixColor(before.flasks[m.a].amt), 420), 260);
      play('pour'); delay = 820;
      setTimeout(update, 300);
    } else if (m.t === 'fill') {
      const se = view.querySelector(`[data-source="${m.s}"]`), fe = view.querySelector(`[data-flask="${m.f}"]`);
      stream(se, fe, mixColor(lv.sources[m.s].comp), 480);
      play('fill'); delay = 420;
      setTimeout(update, 120);
    } else if (m.t === 'empty') {
      play('empty'); update(); delay = 250;
    } else if (m.t === 'deliver') {
      const fe = view.querySelector(`[data-flask="${m.f}"]`), oe = view.querySelector(`[data-order="${m.o}"]`);
      stream(fe, oe, mixColor(before.flasks[m.f].amt), 400);
      play('deliver'); buzz(25); delay = 380;
      setTimeout(update, 150);
    }
    setTimeout(() => {
      busy = false;
      if (isWon(state) && !finished) win();
    }, delay);
  }

  function win() {
    finished = true;
    update();
    const moves = movesCount();
    const stars = starsFor(moves, lv.par, hintUsed);
    const cost = history.reduce((a, h) => a + h.cost, 0);
    play('win'); buzz([30, 60, 30]);
    view.classList.add('won');
    setTimeout(() => opts.onWin({ moves, stars, cost, hintUsed }), 650);
  }

  function onTap(e) {
    if (busy || finished) return;
    const t = e.target.closest('[data-flask],[data-source],[data-sink],[data-order],[data-act]');
    if (!t) { if (sel) { sel = null; update(); } return; }
    clearHint();
    if (t.dataset.act) return action(t.dataset.act);
    const s = cur().state;
    if (t.dataset.source != null) {
      const i = +t.dataset.source;
      sel = sel?.k === 'source' && sel.i === i ? null : { k: 'source', i };
      play('select'); update(); return;
    }
    if (t.dataset.flask != null) {
      const i = +t.dataset.flask;
      if (sel?.k === 'source') return doMove({ t: 'fill', s: sel.i, f: i });
      if (sel?.k === 'flask') return doMove({ t: 'pour', a: sel.i, b: i });
      if (s.flasks[i].vol === 0) { toast('Fiole vide : choisis d\'abord une source.', ''); shake(t); return; }
      sel = { k: 'flask', i }; play('select'); update(); return;
    }
    if (t.dataset.sink != null) {
      if (sel?.k === 'flask') return doMove({ t: 'empty', f: sel.i });
      toast('Choisis d\'abord une fiole à vider.'); return;
    }
    if (t.dataset.order != null) {
      const o = +t.dataset.order;
      if (sel?.k === 'flask') return doMove({ t: 'deliver', f: sel.i, o });
      const ord = lv.orders[o];
      toast(`Commande : ${ord.vol} dose(s) de ${mixName(ord.ratio)}. Choisis une fiole puis touche la commande.`);
    }
  }

  // ----- Indices -----
  function clearHint() { view.querySelectorAll('.hinted').forEach((x) => x.classList.remove('hinted')); }
  function showHint(m) {
    const mark = (q) => view.querySelector(q)?.classList.add('hinted');
    if (m.t === 'fill') { mark(`[data-source="${m.s}"]`); mark(`[data-flask="${m.f}"]`); }
    if (m.t === 'pour') { mark(`[data-flask="${m.a}"]`); mark(`[data-flask="${m.b}"]`); }
    if (m.t === 'empty') { mark(`[data-flask="${m.f}"]`); mark('[data-sink]'); }
    if (m.t === 'deliver') { mark(`[data-flask="${m.f}"]`); mark(`[data-order="${m.o}"]`); }
    const words = { fill: 'Remplis cette fiole depuis la source indiquée.', pour: 'Verse la première fiole indiquée dans la seconde.', empty: 'Vide cette fiole dans l\'évier.', deliver: 'Livre cette fiole !' };
    toast(words[m.t]);
  }
  function hint() {
    if (opts.hints && opts.hints.get() <= 0) { toast('Plus d\'indices : achète-en à l\'atelier.', 'warn'); return; }
    // Si le joueur suit la solution de référence, l'indice est immédiat.
    const played = history.slice(1).map((h) => JSON.stringify(h.move));
    const ref = lv.solution || [];
    let next = null;
    if (played.every((m, i) => m === JSON.stringify(ref[i])) && ref[played.length]) next = ref[played.length];
    const finish = (m) => {
      if (!m) { toast('Le grimoire reste muet… Recommence pour obtenir un indice.', 'warn'); return; }
      if (opts.hints) opts.hints.use();
      hintUsed = true; showHint(m); update();
    };
    if (next) return finish(next);
    toast('Le grimoire réfléchit…');
    setTimeout(() => {
      const r = solve(lv, cur().state, { maxNodes: 60000 });
      finish(r && r.path[0]);
    }, 30);
  }

  function action(a) {
    if (a === 'back') return opts.onExit();
    if (a === 'undo' && history.length > 1) { history.pop(); sel = null; play('select'); update(); }
    if (a === 'restart') { history = [history[0]]; sel = null; update(); }
    if (a === 'hint') hint();
  }

  view.addEventListener('click', onTap);
  const ro = new ResizeObserver(sizeFlasks);
  ro.observe(bench);
  sizeFlasks();
  update();
  return { el: view, destroy() { ro.disconnect(); view.remove(); } };
}
