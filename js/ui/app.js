// Routeur d'écrans et écrans de menu (accueil, grimoire, défi du jour, aide, réglages).
import { el, esc, confirmModal, toast } from './dom.js';
import { ICON } from './icons.js';
import { starsHtml } from './widgets.js';
import { load, save, recordStars, resetAll } from '../storage.js';
import { DOSAGE_CHAPTERS, CHAINS, CAREER_DOSAGE } from '../data/levels-data.js';
import { PIPE_LEVELS } from '../pipes/levels.js';
import { buildPipeLevel, variantDef } from '../pipes/level.js';
import { chainLevels, permuteDosage } from '../career/contracts.js';
import { Rng } from '../core/rng.js';
import { playPuzzle, resultModal } from './play.js';
import { CareerScreen } from './career-view.js';
import { HowTo } from './howto.js';
import { play, applyVolumes } from '../audio.js';

const root = typeof document !== 'undefined' ? document.getElementById('app') : null;
let screen = null;

export function show(fn, params = {}) {
  screen?.destroy?.();
  root.innerHTML = '';
  screen = fn(root, params) || null;
  root.scrollTop = 0;
}

// ---------- Pistes du grimoire ----------
const DOSAGE_NAMES = ['Apprenti', 'Mélanges', 'Trichromie', 'Pénurie & commandes'];
export const TRACKS = {
  dosage: {
    name: 'Dosage', icon: ICON.flask,
    chapters: DOSAGE_CHAPTERS.map((lvls, k) => ({ name: DOSAGE_NAMES[k], items: lvls.map((l) => ({ id: l.id, name: l.name })) })),
  },
  pipes: {
    name: 'Tuyaux', icon: ICON.pipe,
    chapters: [['Apprentissage', 0, 5], ['Réseaux', 5, 10], ['Maîtrise', 10, 15]].map(([name, a, b]) => ({ name, items: PIPE_LEVELS.slice(a, b).map((d) => ({ id: d.id, name: d.name })) })),
  },
  chain: {
    name: 'Chaînes', icon: ICON.chain,
    chapters: [['Petite production', 0, 6], ['Grand Œuvre', 6, 12]].map(([name, a, b]) => ({ name, items: CHAINS.slice(a, b).map((c) => ({ id: c.id, name: c.name })) })),
  },
};

const flatItems = (track) => TRACKS[track].chapters.flatMap((c) => c.items);
const isUnlocked = (track, idx) => idx === 0 || !!load().stars[flatItems(track)[idx - 1].id];

function specFor(track, id) {
  if (track === 'dosage') {
    const lv = DOSAGE_CHAPTERS.flat().find((l) => l.id === id);
    return { spec: { type: 'dosage', level: lv }, name: lv.name, tip: lv.tip };
  }
  if (track === 'pipes') {
    const def = PIPE_LEVELS.find((d) => d.id === id);
    return { spec: { type: 'pipes', level: buildPipeLevel(def) }, name: def.name, tip: def.tip };
  }
  const ch = CHAINS.find((c) => c.id === id);
  const { pipe, dosage } = chainLevels(ch, null);
  return { spec: { type: 'chain', pipe, dosage }, name: ch.name, tip: id === 'ch1' ? 'Une chaîne de production : construis d\'abord le réseau, ses cuves deviennent ensuite les sources du dosage.' : '' };
}

export function startGrimoireLevel(track, id) {
  const items = flatItems(track);
  const idx = items.findIndex((x) => x.id === id);
  const { spec, name, tip } = specFor(track, id);
  const d = load();
  // Les tutoriels montrent toujours leur bulle ; les autres niveaux seulement la première fois.
  const tutorial = /^(d[1-4]|p[1-3]|ch1)$/.test(id);
  const showTip = tip && (tutorial || !d.seenTips[id]) ? tip : '';
  if (tip) { d.seenTips[id] = true; save(); }
  show((r) => playPuzzle(spec, {
    root: r, title: name, subtitle: `${TRACKS[track].name} · ${idx + 1}/${items.length}`, tip: showTip,
    onExit: () => show(Grimoire, { track }),
    onWin: (res) => {
      recordStars(id, res.stars);
      const next = items[idx + 1];
      resultModal({
        stars: res.stars,
        lines: [res.detail, res.stars < 3 ? '<span class="muted">Fais mieux pour obtenir 3 étoiles !</span>' : 'Parfait !'],
        buttons: [
          { label: 'Niveaux', cls: 'ghost', onClick: () => show(Grimoire, { track }) },
          { label: 'Rejouer', cls: 'ghost', onClick: () => startGrimoireLevel(track, id) },
          ...(next ? [{ label: 'Suivant', cls: 'primary', onClick: () => startGrimoireLevel(track, next.id) }] : []),
        ],
      });
    },
  }));
}

// ---------- Accueil ----------
function gearPath(cx, cy, R, r, teeth) {
  let d = '';
  for (let i = 0; i < teeth * 2; i++) {
    const a1 = (i / (teeth * 2)) * Math.PI * 2, a2 = ((i + 1) / (teeth * 2)) * Math.PI * 2, rad = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(cx + rad * Math.cos(a1)).toFixed(1)} ${(cy + rad * Math.sin(a1)).toFixed(1)} L${(cx + rad * Math.cos(a2)).toFixed(1)} ${(cy + rad * Math.sin(a2)).toFixed(1)} `;
  }
  return d + 'Z';
}
function gearSvg(size, cls, pos, color) {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" style="${pos}"><g class="${cls}"><path d="${gearPath(50, 50, 48, 40, 12)}" fill="none" stroke="${color}" stroke-width="2.5" opacity=".55"/>
    <circle cx="50" cy="50" r="22" fill="none" stroke="${color}" stroke-width="2" opacity=".5"/><circle cx="50" cy="50" r="6" fill="${color}" opacity=".5"/></g></svg>`;
}

export function Home(r) {
  const d = load();
  const c = d.career;
  const v = el(`<div class="screen menu home">
    <div class="gears" aria-hidden="true">${gearSvg(150, 'gear-spin', 'top:-40px;right:-50px', '#c79a45')}${gearSvg(96, 'gear-spin rev', 'top:70px;right:70px', '#c06a34')}${gearSvg(180, 'gear-spin rev', 'bottom:-60px;left:-70px', '#c79a45')}${gearSvg(80, 'gear-spin', 'bottom:90px;left:80px', '#26f2ff')}</div>
    <div class="logo">
      <svg viewBox="0 0 120 120" class="logo-svg" aria-hidden="true">
        <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff2fd2"/><stop offset=".5" stop-color="#9b5cff"/><stop offset="1" stop-color="#26f2ff"/></linearGradient></defs>
        <g class="gear-spin" opacity=".9"><path d="${gearPath(60, 60, 54, 46, 14)}" fill="none" stroke="#c79a45" stroke-width="3"/></g>
        <path d="M48 14h24M52 14v28L26 92a10 10 0 009 15h50a10 10 0 009-15L68 42V14" fill="#07070d" stroke="#f0cf7e" stroke-width="5" stroke-linejoin="round"/>
        <path d="M37 76h46l9 17a6 6 0 01-5 9H33a6 6 0 01-5-9z" fill="url(#lg)"/>
        <circle class="bub b1" cx="52" cy="86" r="4" fill="#fff9"/><circle class="bub b2" cx="66" cy="92" r="3" fill="#fff9"/><circle class="bub b3" cx="60" cy="80" r="2.5" fill="#fff9"/>
      </svg>
      <h1>Alchimie</h1><p class="subtitle">L'Atelier · néo-vapeur</p>
    </div>
    <nav class="menu-list">
      ${c ? `<button class="btn primary big" data-go="career">${ICON.shop}<span>Continuer la carrière<small>Jour ${Math.min(c.day, 30)} · ${c.gold} or</small></span></button>` : ''}
      <button class="btn ${c ? '' : 'primary'} big" data-go="newcareer">${ICON.map}<span>${c ? 'Nouvelle carrière' : 'Carrière'}<small>Gère ton atelier d'alchimiste</small></span></button>
      <button class="btn big" data-go="grimoire">${ICON.scroll}<span>Grimoire d'énigmes<small>Dosage · Tuyaux · Chaînes</small></span></button>
      <button class="btn big" data-go="daily">${ICON.calendar}<span>Défi du jour<small>${dailyLabel()}</small></span></button>
      <div class="menu-row">
        <button class="btn" data-go="howto">${ICON.help}<span>Comment jouer</span></button>
        <button class="btn" data-go="settings">${ICON.gear}<span>Réglages</span></button>
      </div>
    </nav>
  </div>`);
  v.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    play('ui');
    const g = b.dataset.go;
    if (g === 'career') show(CareerScreen, { onHome: () => show(Home) });
    if (g === 'newcareer') {
      const start = () => show(CareerScreen, { fresh: true, onHome: () => show(Home) });
      if (c && !c.ended) confirmModal('Nouvelle carrière', 'Ta carrière en cours sera effacée. Continuer ?', start, 'Recommencer');
      else start();
    }
    if (g === 'grimoire') show(Grimoire, { track: 'dosage' });
    if (g === 'daily') startDaily();
    if (g === 'howto') show(HowTo, { onBack: () => show(Home) });
    if (g === 'settings') show(Settings);
  });
  r.appendChild(v);
}

// ---------- Grimoire ----------
export function Grimoire(r, { track = 'dosage' }) {
  const d = load();
  const T = TRACKS[track];
  let idx = 0;
  const total = flatItems(track).length;
  const got = flatItems(track).reduce((a, it) => a + (d.stars[it.id] || 0), 0);
  const v = el(`<div class="screen menu grimoire">
    <header class="bar"><button class="icon-btn" data-act="back" aria-label="Retour">${ICON.back}</button>
      <div class="bar-title"><strong>Grimoire d'énigmes</strong><small>${T.name} · ★ ${got}/${total * 3}</small></div></header>
    <div class="tabs" role="tablist">${Object.entries(TRACKS).map(([k, t]) => `<button role="tab" class="tab ${k === track ? 'active' : ''}" data-track="${k}">${t.icon}<span>${t.name}</span></button>`).join('')}</div>
    <div class="scroll">${T.chapters.map((ch) => `<section class="chapter"><h3>${esc(ch.name)}</h3><div class="level-grid">${ch.items.map((it) => {
      const i = idx++;
      const un = isUnlocked(track, i);
      return `<button class="level ${un ? '' : 'locked'} ${d.stars[it.id] ? 'done' : ''}" data-id="${it.id}" ${un ? '' : 'disabled'}>
        <span class="lv-n">${i + 1}</span><span class="lv-name">${esc(it.name)}</span>${un ? starsHtml(d.stars[it.id] || 0) : ICON.lock}</button>`;
    }).join('')}</div></section>`).join('')}</div>
  </div>`);
  v.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="back"]')) return show(Home);
    const tb = e.target.closest('[data-track]'); if (tb) return show(Grimoire, { track: tb.dataset.track });
    const lb = e.target.closest('[data-id]'); if (lb) { play('ui'); startGrimoireLevel(track, lb.dataset.id); }
  });
  r.appendChild(v);
}

// ---------- Défi du jour ----------
function todayKey() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
function dailyLabel() {
  const s = load().daily[todayKey()];
  return s ? `Réussi aujourd'hui ${'★'.repeat(s)}` : 'Une nouvelle énigme chaque jour';
}
const PERMS = [null, { R: 'B', Y: 'R', B: 'Y' }, { R: 'Y', Y: 'B', B: 'R' }, { R: 'R', Y: 'B', B: 'Y' }];

export function dailySpec(key = todayKey()) {
  const rng = new Rng('daily|' + key);
  const kind = ['dosage', 'pipes', 'chain'][rng.int(0, 2)];
  const perm = rng.pick(PERMS);
  if (kind === 'dosage') {
    const tier = rng.int(2, 3);
    const lv = permuteDosage(rng.pick(CAREER_DOSAGE[tier]), perm);
    return { spec: { type: 'dosage', level: lv }, label: 'Dosage' };
  }
  if (kind === 'pipes') {
    const def = rng.pick(PIPE_LEVELS.slice(5));
    return { spec: { type: 'pipes', level: buildPipeLevel(variantDef(def, { mirror: rng.chance(0.5), perm })) }, label: 'Tuyaux' };
  }
  const { pipe, dosage } = chainLevels(rng.pick(CHAINS), perm);
  return { spec: { type: 'chain', pipe, dosage }, label: 'Chaîne' };
}

function startDaily() {
  const key = todayKey();
  const { spec, label } = dailySpec(key);
  const dateTxt = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  show((r) => playPuzzle(spec, {
    root: r, title: 'Défi du jour', subtitle: `${label} · ${dateTxt}`,
    onExit: () => show(Home),
    onWin: (res) => {
      const d = load();
      d.daily[key] = Math.max(d.daily[key] || 0, res.stars); save();
      const streak = dailyStreak();
      resultModal({ stars: res.stars, lines: [res.detail, `Série : ${streak} jour${streak > 1 ? 's' : ''} d'affilée`, '<span class="muted">Reviens demain pour un nouveau défi !</span>'],
        buttons: [{ label: 'Rejouer', cls: 'ghost', onClick: startDaily }, { label: 'Accueil', cls: 'primary', onClick: () => show(Home) }] });
    },
  }));
}

function dailyStreak() {
  const d = load().daily;
  let n = 0;
  const t = new Date();
  for (;;) {
    const k = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    if (!d[k]) break;
    n++; t.setDate(t.getDate() - 1);
  }
  return n;
}

// ---------- Réglages ----------
function Settings(r) {
  const d = load();
  const v = el(`<div class="screen menu settings">
    <header class="bar"><button class="icon-btn" data-act="back" aria-label="Retour">${ICON.back}</button><div class="bar-title"><strong>Réglages</strong></div></header>
    <div class="scroll">
      <label class="toggle"><span>Sons</span><input type="checkbox" data-set="sound" ${d.settings.sound ? 'checked' : ''}></label>
      <label class="toggle slider"><span>Effets sonores</span><input type="range" min="0" max="100" step="5" data-vol="sfxVol" value="${Math.round((d.settings.sfxVol ?? 0.8) * 100)}"></label>
      <label class="toggle slider"><span>Ambiance machinerie</span><input type="range" min="0" max="100" step="5" data-vol="ambVol" value="${Math.round((d.settings.ambVol ?? 0.35) * 100)}"></label>
      <label class="toggle"><span>Vibrations</span><input type="checkbox" data-set="vibrate" ${d.settings.vibrate ? 'checked' : ''}></label>
      <button class="btn danger" data-act="reset">Effacer toute la progression</button>
      <div class="about"><p><b>Alchimie : l'Atelier</b></p><p class="muted">Jeu de réflexion et de stratégie : dosage de fioles, réseaux de tuyaux, chaînes de production et gestion d'atelier. Fonctionne hors-ligne.</p>
      <p class="muted">Sons : Kenney (kenney.nl, CC0) et liquides synthétisés. Polices : Orbitron, Rajdhani, Share Tech Mono (OFL).</p>
      <p class="muted">Astuce : dans Chrome, menu ⋮ → « Ajouter à l'écran d'accueil » pour l'installer comme une application.</p></div>
    </div></div>`);
  v.addEventListener('input', (e) => {
    const k = e.target.dataset.vol; if (!k) return;
    d.settings[k] = +e.target.value / 100; save(); applyVolumes();
  });
  v.addEventListener('change', (e) => {
    if (e.target.dataset.vol) { play(e.target.dataset.vol === 'sfxVol' ? 'deliver' : 'ui'); return; }
    const k = e.target.dataset.set; if (!k) return;
    d.settings[k] = e.target.checked; save(); applyVolumes();
    if (k === 'sound' && e.target.checked) play('coin');
  });
  v.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="back"]')) show(Home);
    if (e.target.closest('[data-act="reset"]')) confirmModal('Tout effacer ?', 'Étoiles, défis et carrière seront perdus.', () => { resetAll(); toast('Progression effacée.'); show(Home); }, 'Effacer');
  });
  r.appendChild(v);
}

export function boot() {
  show(Home);
}
