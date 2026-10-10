// Écran des succès + notification de déblocage.
import { el, esc } from './dom.js';
import { ICON } from './icons.js';
import { ACHIEVEMENTS, progressOf } from '../achievements.js';
import { load } from '../storage.js';
import { play, buzz } from '../audio.js';

export function AchievementsScreen(r, { onBack }) {
  const d = load();
  const got = ACHIEVEMENTS.filter((a) => d.ach?.[a.id]).length;
  const v = el(`<div class="screen menu achievements">
    <header class="bar"><button class="icon-btn" data-act="back" aria-label="Retour">${ICON.back}</button>
      <div class="bar-title"><strong>Succès</strong><small>${got} / ${ACHIEVEMENTS.length} débloqués</small></div></header>
    <div class="rep-bar"><div style="width:${(got / ACHIEVEMENTS.length) * 100}%"></div></div>
    <div class="scroll"><div class="ach-grid">${ACHIEVEMENTS.map((a) => {
      const when = d.ach?.[a.id];
      const p = progressOf(a);
      return `<article class="ach ${when ? 'on' : ''}">
        <span class="ach-ico">${when ? a.icon : '🔒'}</span>
        <div><b>${esc(a.name)}</b><p>${esc(a.desc)}</p>
        ${when ? `<small class="muted">Débloqué le ${new Date(when).toLocaleDateString('fr-FR')}</small>`
    : a.stat ? `<div class="ach-prog"><i style="width:${p * 100}%"></i></div><small class="muted">${Math.min(d.stats?.[a.stat[0]] || 0, a.stat[1])} / ${a.stat[1]}</small>` : ''}</div>
      </article>`;
    }).join('')}</div></div></div>`);
  v.querySelector('[data-act="back"]').onclick = onBack;
  r.appendChild(v);
}

/** Bandeau doré « Succès débloqué ». */
export function notifyAchievement(a) {
  const n = el(`<div class="ach-toast" role="status"><span class="ach-ico">${a.icon}</span><div><small>Succès débloqué</small><b>${esc(a.name)}</b></div></div>`);
  document.body.appendChild(n);
  play('coin'); buzz([20, 40, 20]);
  setTimeout(() => n.classList.add('out'), 2300);
  setTimeout(() => n.remove(), 2800);
}
