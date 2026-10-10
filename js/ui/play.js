// Lancement d'une énigme (dosage, tuyaux ou chaîne) et fenêtre de résultat.
import { DosageView } from './dosage-view.js';
import { PipesView } from './pipes-view.js';
import { modal, el } from './dom.js';
import { starsHtml, swatch, chips } from './widgets.js';
import { mixName } from '../core/color.js';
import { chainSourcesFromPipe } from '../chain/chain.js';
import { play } from '../audio.js';

/**
 * spec : { type: 'dosage'|'pipes', level } | { type: 'chain', pipe, dosage }
 * opts : { root, title, subtitle, tip, prices, pieceCost, hints, onWin(result), onExit() }
 * Le résultat : { stars, cost, detail }
 */
export function playPuzzle(spec, opts) {
  let current = null;
  const mount = (v) => { current?.destroy(); current = v; };
  const base = { prices: opts.prices, pieceCost: opts.pieceCost, hints: opts.hints, onExit: () => opts.onExit() };

  if (spec.type === 'dosage') {
    mount(DosageView(opts.root, { ...base, level: spec.level, title: opts.title, subtitle: opts.subtitle, tip: opts.tip,
      onWin: (r) => opts.onWin({ stars: r.stars, cost: r.cost, detail: `${r.moves} coups (optimum ${spec.level.par})`, hintUsed: r.hintUsed, close: () => current?.destroy() }) }));
  } else if (spec.type === 'pipes') {
    mount(PipesView(opts.root, { ...base, level: spec.level, title: opts.title, subtitle: opts.subtitle, tip: opts.tip,
      onWin: (r) => opts.onWin({ stars: r.stars, cost: r.cost, detail: spec.level.par ? `${r.pieces} pièces (référence ${spec.level.par})` : 'Vannes réglées !', hintUsed: r.hintUsed, close: () => current?.destroy() }) }));
  } else {
    mount(PipesView(opts.root, { ...base, level: spec.pipe, title: opts.title, subtitle: 'Étape 1/2 · Tuyauterie', tip: opts.tip,
      onWin: (r1) => {
        const outs = chainSourcesFromPipe(spec.pipe);
        play('flow');
        modal({
          title: 'Réseau terminé !', dismissable: false,
          body: `<p>${starsHtml(r1.stars)}</p><p>Tes cuves produisent maintenant :</p>
            <div class="chain-outs">${outs.map((s) => `<div>${swatch(s.comp, 30)}<b>${mixName(s.comp)}</b>${chips(s.comp, { compact: true })}</div>`).join('')}</div>
            <p class="muted">Ces mélanges deviennent tes sources pour le dosage final.</p>`,
          buttons: [{ label: 'Étape 2 : Dosage', cls: 'primary', onClick: () => {
            mount(DosageView(opts.root, { ...base, level: spec.dosage, title: opts.title, subtitle: 'Étape 2/2 · Dosage',
              onWin: (r2) => opts.onWin({
                stars: Math.floor((r1.stars + r2.stars) / 2), cost: r1.cost + r2.cost,
                detail: `Réseau : ${r1.pieces} pièces · Dosage : ${r2.moves} coups`, hintUsed: r1.hintUsed || r2.hintUsed, close: () => current?.destroy(),
              }) }));
          } }],
        });
      } }));
  }
  return { destroy: () => current?.destroy() };
}

export function resultModal({ title = 'Réussi !', stars, lines = [], buttons }) {
  const body = el(`<div class="result"><div class="big-stars">${starsHtml(stars)}</div>${lines.map((l) => `<p>${l}</p>`).join('')}</div>`);
  modal({ title, body, buttons, dismissable: false, cls: 'win' });
}
