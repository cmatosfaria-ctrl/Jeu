// Éléments visuels partagés : puces de proportions, pastilles, étoiles.
import { mixColor, ratioParts, mixName } from '../core/color.js';

export function chips(ratio, { compact = false } = {}) {
  if (!ratio || ratio.every((v) => !v)) return '<span class="chips"></span>';
  return `<span class="chips ${compact ? 'compact' : ''}">${ratioParts(ratio)
    .map((x) => `<span class="chip" title="${x.name}"><i style="background:${x.css}"></i>${x.k}</span>`).join('')}</span>`;
}

export function swatch(ratio, size = 28) {
  return `<span class="swatch" style="width:${size}px;height:${size}px;background:${mixColor(ratio)}"></span>`;
}

export function starsHtml(n, max = 3) {
  let h = '<span class="stars" aria-label="' + n + ' étoile(s)">';
  for (let i = 0; i < max; i++) h += `<span class="${i < n ? 'on' : ''}">★</span>`;
  return h + '</span>';
}

export function colorLabel(ratio) {
  return mixName(ratio);
}

export const fmtGold = (v) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');
