// Mode Contre-la-montre : dosages enchaînés, temps bonus, combos, records.
import { el, modal } from './dom.js';
import { DosageView } from './dosage-view.js';
import { DOSAGE_CHAPTERS, CAREER_DOSAGE } from '../data/levels-data.js';
import { permuteDosage } from '../career/contracts.js';
import { Rng } from '../core/rng.js';
import { load, save } from '../storage.js';
import { play, buzz } from '../audio.js';
import { setMusicIntensity } from '../music.js';
import { track } from '../achievements.js';

export const TA_START = 120;
const PERMS = [null, { R: 'B', Y: 'R', B: 'Y' }, { R: 'Y', Y: 'B', B: 'R' }, { R: 'R', Y: 'B', B: 'Y' }, { R: 'B', Y: 'Y', B: 'R' }];

/** Suite d'énigmes de difficulté croissante (sans réactions, petites). */
export function taPool(seed) {
  const rng = new Rng('ta|' + seed);
  const easy = [...DOSAGE_CHAPTERS[0].slice(4), ...CAREER_DOSAGE[0]];
  const mid = [...DOSAGE_CHAPTERS[1], ...CAREER_DOSAGE[1]];
  const hard = [...DOSAGE_CHAPTERS[2], ...CAREER_DOSAGE[2]];
  return [...rng.shuffle(easy).slice(0, 6), ...rng.shuffle(mid), ...rng.shuffle(hard)]
    .map((lv) => permuteDosage(lv, rng.pick(PERMS)));
}

/** Points pour une énigme : base + bonus d'optimalité, multipliés par le combo. */
export function taPoints(moves, par, combo) {
  const base = 100 + Math.max(0, 6 - Math.max(0, moves - par)) * 10;
  return Math.round(base * (1 + 0.25 * Math.max(0, combo - 1)));
}

export function TimeAttack(root, { onHome }) {
  const pool = taPool(Date.now());
  let idx = 0, timeLeft = TA_START, score = 0, combo = 0, bestCombo = 0, solved = 0, over = false, paused = false;
  let game = null, last = performance.now(), raf = 0;

  const v = el(`<div class="screen ta">
    <div class="ta-hud">
      <div class="ta-row"><span class="ta-time"></span><span class="ta-score"></span><span class="ta-combo"></span>
        <button class="btn small ghost" data-act="skip">Passer −10 s</button></div>
      <div class="ta-bar"><div></div></div>
    </div>
    <div class="ta-game"></div>
  </div>`);
  root.appendChild(v);
  const $ = (q) => v.querySelector(q);

  function hud() {
    const t = Math.max(0, timeLeft);
    $('.ta-time').textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    $('.ta-time').classList.toggle('low', t < 20);
    $('.ta-score').innerHTML = `<b>${score}</b> pts`;
    $('.ta-combo').innerHTML = combo > 1 ? `combo <b>×${(1 + 0.25 * (combo - 1)).toFixed(2).replace(/0$/, '')}</b>` : '';
    $('.ta-bar div').style.width = Math.min(100, (t / TA_START) * 100) + '%';
    $('.ta-bar').classList.toggle('low', t < 20);
  }

  function next() {
    game?.destroy();
    const lv = pool[idx++ % pool.length];
    const box = $('.ta-game');
    box.innerHTML = '';
    game = DosageView(box, {
      level: lv, title: `Énigme ${idx}`, subtitle: `Optimum ${lv.par} coups`, hints: null, noHint: true,
      onExit: () => {
        paused = true;
        modal({ title: 'Abandonner ?', body: '<p>La partie en cours sera perdue.</p>', buttons: [
          { label: 'Continuer', cls: 'ghost', onClick: () => { paused = false; last = performance.now(); } },
          { label: 'Quitter', cls: 'primary', onClick: () => { stop(); onHome(); } },
        ] });
      },
      onWin: ({ moves }) => {
        const optimal = moves <= lv.par;
        combo = optimal ? combo + 1 : 0;
        bestCombo = Math.max(bestCombo, combo);
        const pts = taPoints(moves, lv.par, combo);
        const bonus = 12 + (optimal ? 6 : 0);
        score += pts; timeLeft += bonus; solved++;
        floatText(`+${pts} pts · +${bonus} s`, optimal);
        play('coin');
        track({ taSolved: solved, taCombo: bestCombo, taScore: score });
        hud();
        setTimeout(() => { if (!over) next(); }, 350);
      },
    });
  }

  function floatText(txt, gold) {
    const f = el(`<div class="ta-float ${gold ? 'gold' : ''}">${txt}</div>`);
    v.appendChild(f);
    setTimeout(() => f.remove(), 1400);
  }

  function tick(now) {
    const dt = (now - last) / 1000; last = now;
    if (!paused && !over && !document.hidden) {
      const before = Math.ceil(timeLeft);
      timeLeft -= dt;
      if (Math.ceil(timeLeft) !== before && timeLeft < 10 && timeLeft > 0) { play('ui'); buzz(8); }
      setMusicIntensity(0.55 + 0.45 * Math.max(0, 1 - timeLeft / TA_START));
      if (timeLeft <= 0) return end();
      hud();
    }
    raf = requestAnimationFrame(tick);
  }

  function end() {
    over = true; hud();
    game?.destroy(); game = null;
    const d = load();
    d.taRecords = [...(d.taRecords || []), { score, solved, combo: bestCombo, date: Date.now() }]
      .sort((a, b) => b.score - a.score).slice(0, 5);
    save();
    const best = d.taRecords[0];
    const isBest = best.score === score && score > 0;
    play(isBest ? 'win' : 'error');
    modal({
      title: 'Temps écoulé !', dismissable: false, cls: 'win',
      body: `<div class="result"><p class="ta-final">${score} <small>pts</small></p>
        <p>${solved} énigme${solved > 1 ? 's' : ''} résolue${solved > 1 ? 's' : ''} · meilleur combo ×${(1 + 0.25 * Math.max(0, bestCombo - 1)).toFixed(2).replace(/0$/, '')}</p>
        ${isBest ? '<p class="news">Nouveau record !</p>' : ''}
        <h3>Records</h3><ol class="ta-records">${d.taRecords.map((r) => `<li><b>${r.score}</b> pts · ${r.solved} énigmes <span class="muted">${new Date(r.date).toLocaleDateString('fr-FR')}</span></li>`).join('')}</ol></div>`,
      buttons: [{ label: 'Accueil', cls: 'ghost', onClick: onHome }, { label: 'Rejouer', cls: 'primary', onClick: () => { stop(); root.innerHTML = ''; TimeAttack(root, { onHome }); } }],
    });
  }

  function stop() { over = true; cancelAnimationFrame(raf); game?.destroy(); }

  v.querySelector('[data-act="skip"]').addEventListener('click', () => {
    if (over) return;
    timeLeft -= 10; combo = 0; play('rotate'); floatText('−10 s', false); hud(); next();
  });

  hud(); next();
  raf = requestAnimationFrame((t) => { last = t; tick(t); });
  return { destroy: stop };
}
