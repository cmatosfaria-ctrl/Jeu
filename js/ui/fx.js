// Effets visuels : particules, étincelles, bouffées de vapeur, onde de victoire.
import { el } from './dom.js';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/** Position (x, y) du centre d'un élément relativement au conteneur. */
export function centerIn(elm, container, dy = 0.5) {
  const r = elm.getBoundingClientRect(), c = container.getBoundingClientRect();
  return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height * dy, w: r.width, h: r.height };
}

/**
 * Gerbe de particules. opts : { n, colors, spread, rise, size, dur, kind: 'bubble'|'spark'|'steam' }
 */
export function burst(layer, x, y, opts = {}) {
  if (reduced() || !layer) return;
  const { n = 14, colors = ['#26f2ff', '#ff2fd2'], spread = 60, rise = 70, size = 6, dur = 900, kind = 'spark', delay = 0 } = opts;
  for (let i = 0; i < n; i++) {
    const c = colors[i % colors.length];
    const s = size * (0.5 + Math.random());
    const p = el(`<i class="fx fx-${kind}" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;--c:${c}"></i>`);
    layer.appendChild(p);
    const ang = Math.random() * Math.PI * 2;
    const dx = kind === 'spark' ? Math.cos(ang) * spread * (0.4 + Math.random()) : (Math.random() - 0.5) * spread;
    const dy = kind === 'spark' ? Math.sin(ang) * spread * (0.4 + Math.random()) - rise * 0.3 : -rise * (0.5 + Math.random());
    const scaleEnd = kind === 'steam' ? 3 + Math.random() * 2 : 0.2;
    p.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.15 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scaleEnd})`, opacity: 0 },
    ], { duration: dur * (0.7 + Math.random() * 0.6), delay: delay + Math.random() * 120, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' })
      .onfinish = () => p.remove();
  }
}

/** Anneau lumineux qui s'étend (onde de choc). */
export function ring(layer, x, y, color = '#26f2ff', size = 90, delay = 0) {
  if (reduced() || !layer) return;
  const r = el(`<i class="fx fx-ring" style="left:${x}px;top:${y}px;--c:${color}"></i>`);
  layer.appendChild(r);
  r.animate([
    { width: '6px', height: '6px', opacity: 1 },
    { width: `${size}px`, height: `${size}px`, opacity: 0 },
  ], { duration: 650, delay, easing: 'ease-out', fill: 'backwards' }).onfinish = () => r.remove();
}

/** Célébration de victoire : étincelles néon + vapeur depuis plusieurs points. */
export function celebrate(layer, points, colors) {
  points.forEach((pt, i) => {
    ring(layer, pt.x, pt.y, colors[i % colors.length], 140, i * 90);
    burst(layer, pt.x, pt.y, { n: 18, colors, spread: 110, size: 7, kind: 'spark', delay: i * 90 });
    burst(layer, pt.x, pt.y, { n: 6, colors: ['#ffffff55'], spread: 50, rise: 90, size: 18, dur: 1400, kind: 'steam', delay: 120 + i * 90 });
  });
}
