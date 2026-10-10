// Écran Carrière : contrats, carte, atelier, marché, journal.
import { el, esc, modal, confirmModal, toast } from './dom.js';
import { ICON } from './icons.js';
import { fmtGold } from './widgets.js';
import { load, save } from '../storage.js';
import {
  newCareer, accept, abandon, complete, nextDay, buyUpgrade, buyHints, marketOf, pieceCost, missingReqs,
  notebookSize, unlockedTowns, finalScore, seasonVerdict, continueFree, payout, STAR_FACTOR,
} from '../career/career.js';
import { TOWNS, UPGRADES, HINT_PACK, SEASON_DAYS, rankFor, RANKS, GOAL_REP, PIECE_PRICES } from '../career/data.js';
import { buildPuzzle, chainLevels } from '../career/contracts.js';
import { PRIMARY_INFO, PRIMARIES } from '../core/color.js';
import { playPuzzle, resultModal } from './play.js';
import { show } from './app.js';
import { play } from '../audio.js';

const TYPE_INFO = {
  dosage: { name: 'Dosage', icon: ICON.flask },
  pipes: { name: 'Tuyauterie', icon: ICON.pipe },
  chain: { name: 'Chaîne', icon: ICON.chain },
};
const REQ_NAMES = { B: 'Pigment Bleu', W: 'Pigment Blanc', flask3: '3ᵉ fiole', S: 'Séparateur', X: 'Croisement', M: 'Mélangeur', alembic: 'Grand alambic' };
const townName = (id) => TOWNS.find((t) => t.id === id)?.name || id;

let tab = 'contracts';

export function CareerScreen(r, params) {
  const d = load();
  if (params.fresh || !d.career) { d.career = newCareer(); save(); tab = 'contracts'; }
  const st = d.career;
  const persist = () => save();

  const v = el(`<div class="screen menu career">
    <header class="bar">
      <button class="icon-btn" data-act="home" aria-label="Accueil">${ICON.back}</button>
      <div class="bar-title"><strong>Jour ${Math.min(st.day, SEASON_DAYS)}${st.free ? '' : ` / ${SEASON_DAYS}`}</strong><small>${rankFor(st.rep).name}</small></div>
      <div class="purse"><span class="gold">${ICON.coin}<b>${st.gold}</b></span><span class="rep">${ICON.star}<b>${st.rep}</b></span></div>
    </header>
    <div class="rep-bar" title="Réputation"><div style="width:${Math.min(100, (st.rep / GOAL_REP) * 100)}%"></div>
      ${RANKS.slice(1).map((k) => `<i style="left:${(k.rep / GOAL_REP) * 100}%"></i>`).join('')}</div>
    <div class="scroll career-body"></div>
    <nav class="bottom-nav">
      ${[['contracts', 'Contrats', ICON.scroll], ['map', 'Carte', ICON.map], ['shop', 'Atelier', ICON.shop], ['market', 'Marché', ICON.chart], ['log', 'Journal', ICON.calendar]]
        .map(([k, n, ic]) => `<button class="${tab === k ? 'active' : ''}" data-tab="${k}">${ic}<span>${n}</span></button>`).join('')}
    </nav>
  </div>`);
  const body = v.querySelector('.career-body');
  const rerender = () => show(CareerScreen, { onHome: params.onHome });

  // ---------- Onglets ----------
  function contractCard(c, mode) {
    const ti = TYPE_INFO[c.type];
    const miss = mode === 'board' ? missingReqs(st, c) : [];
    const left = mode === 'notebook' ? c.due - st.day : null;
    const due = mode === 'notebook'
      ? (left <= 0 ? '<b class="warn">Dernier jour !</b>' : `Reste ${left + 1} jour${left > 0 ? 's' : ''}`)
      : `Délai : ${c.deadline} jours`;
    return `<article class="contract t-${c.type} ${miss.length ? 'blocked' : ''}">
      <div class="c-icon">${ti.icon}</div>
      <div class="c-main">
        <div class="c-head"><b>${esc(c.client)}</b><span class="tier">${'◆'.repeat(c.tier)}</span></div>
        <div class="c-sub">${ti.name} · ${townName(c.town)}</div>
        <div class="c-meta"><span class="gold">${ICON.coin}${c.reward}</span><span class="rep">${ICON.star}+${c.rep}</span><span>${due}</span></div>
        ${miss.length ? `<div class="c-req">${ICON.lock} Requis : ${miss.map((m) => REQ_NAMES[m]).join(', ')}</div>` : ''}
      </div>
      <div class="c-actions">
        ${mode === 'board'
    ? `<button class="btn small primary" data-accept="${c.id}" ${miss.length ? 'disabled' : ''}>Accepter</button>`
    : `<button class="btn small primary" data-play="${c.id}">${ICON.play}Jouer</button><button class="btn small ghost" data-abandon="${c.id}">Abandonner</button>`}
      </div>
    </article>`;
  }

  function renderContracts() {
    const m = marketOf(st);
    body.innerHTML = `
      ${m.event ? `<div class="event">${ICON.chart} ${m.event}</div>` : ''}
      <section><h3>Carnet <span class="muted">${st.notebook.length}/${notebookSize(st)}</span></h3>
        ${st.notebook.length ? st.notebook.map((c) => contractCard(c, 'notebook')).join('') : '<p class="muted empty-note">Aucun contrat en cours. Accepte des commandes ci-dessous.</p>'}
      </section>
      <section><h3>Tableau du jour</h3>
        ${st.board.length ? st.board.map((c) => contractCard(c, 'board')).join('') : '<p class="muted empty-note">Plus d\'offres aujourd\'hui.</p>'}
      </section>
      <p class="muted small-note">Réaliser un contrat prend une journée. Le paiement dépend des étoiles (100 / 75 / 50 %) moins le coût des pigments ou des pièces.</p>
      <button class="btn wide" data-act="rest">${ICON.sun} Passer la journée</button>`;
  }

  function renderMap() {
    const un = unlockedTowns(st);
    const roads = [[0, 1], [0, 2], [1, 3], [2, 3]];
    body.innerHTML = `<div class="map">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="roads">${roads.map(([a, b]) => `<line x1="${TOWNS[a].x}" y1="${TOWNS[a].y}" x2="${TOWNS[b].x}" y2="${TOWNS[b].y}"/>`).join('')}</svg>
      <div class="sea"></div>
      ${TOWNS.map((t) => `<button class="town ${un.includes(t.id) ? '' : 'locked'}" style="left:${t.x}%;top:${t.y}%" data-town="${t.id}">
        <span class="town-dot">${un.includes(t.id) ? '◆'.repeat(t.tier) : ICON.lock}</span><span class="town-name">${t.name}</span></button>`).join('')}
    </div>
    <div class="town-list">${TOWNS.map((t) => `<div class="town-row ${un.includes(t.id) ? '' : 'locked'}"><b>${t.name}</b>
      <span class="muted">${un.includes(t.id) ? t.desc : `Débloquée à ${t.rep} de réputation.`}</span></div>`).join('')}</div>
    <h3>Rangs</h3><div class="ranks">${RANKS.map((k) => `<span class="${st.rep >= k.rep ? 'on' : ''}">${k.name} <small>${k.rep}</small></span>`).join('')}</div>
    <p class="muted small-note">Objectif : atteindre ${GOAL_REP} de réputation avant la fin du jour ${SEASON_DAYS} pour devenir Grand Alchimiste.</p>`;
  }

  function renderShop() {
    body.innerHTML = `<section><h3>Améliorations</h3>${UPGRADES.map((u) => {
      const own = st.owned.includes(u.id);
      const lockedBy = u.needs && !st.owned.includes(u.needs);
      return `<article class="upgrade ${own ? 'owned' : ''}"><div><b>${u.name}</b><p class="muted">${u.desc}</p></div>
        ${own ? `<span class="owned-tag">${ICON.check}Acquis</span>` : `<button class="btn small ${st.gold >= u.cost && !lockedBy ? 'primary' : ''}" data-buy="${u.id}" ${lockedBy ? 'disabled' : ''}>${ICON.coin}${u.cost}</button>`}</article>`;
    }).join('')}</section>
    <section><h3>Grimoire d'indices</h3><article class="upgrade"><div><b>${HINT_PACK.count} indices</b><p class="muted">Tu en possèdes ${st.hints}. Un indice limite le contrat à 2 étoiles.</p></div>
      <button class="btn small" data-act="hints">${ICON.coin}${HINT_PACK.cost}</button></article></section>`;
  }

  function renderMarket() {
    const m = marketOf(st), y = marketOf(st, Math.max(1, st.day - 1));
    const trend = (p) => (st.day === 1 || m.prices[p] === y.prices[p] ? '<span class="muted">=</span>' : m.prices[p] > y.prices[p] ? '<span class="up">▲</span>' : '<span class="down">▼</span>');
    body.innerHTML = `${m.event ? `<div class="event">${m.event}</div>` : ''}
      <section><h3>Pigments (prix par dose)</h3><div class="prices">${PRIMARIES.map((p) => `<div class="price"><i style="background:${PRIMARY_INFO[p].css};color:${PRIMARY_INFO[p].css}"></i>
        <span>${PRIMARY_INFO[p].name}</span><b>${fmtGold(m.prices[p])}</b>${trend(p)}</div>`).join('')}</div></section>
      <section><h3>Pièces de tuyauterie</h3><div class="prices">${Object.keys(PIECE_PRICES).map((k) => `<div class="price"><span>${{ I: 'Droit', L: 'Coude', X: 'Croisement', S: 'Séparateur', M: 'Mélangeur' }[k]}</span><b>${fmtGold(pieceCost(st, k))}</b></div>`).join('')}</div></section>
      <p class="muted small-note">Les prix changent chaque jour. Un dosage économe (peu de pigments gaspillés à l'évier) et un réseau sobre rapportent plus.</p>`;
  }

  function renderLog() {
    const s = st.stats;
    body.innerHTML = `<section class="stats"><div><b>${s.done}</b><span>contrats</span></div><div><b>${s.stars}</b><span>étoiles</span></div>
      <div><b>${s.failed}</b><span>échecs</span></div><div><b>${s.earned}</b><span>or gagné</span></div></section>
      <section><h3>Journal</h3><ul class="log">${st.log.map((l) => `<li><span class="muted">J${l.day}</span> ${esc(l.msg)}</li>`).join('')}</ul></section>`;
  }

  const renderers = { contracts: renderContracts, map: renderMap, shop: renderShop, market: renderMarket, log: renderLog };
  renderers[tab]();

  // ---------- Actions ----------
  function showNews(news) { news.forEach((n, i) => setTimeout(() => toast(n), i * 2300)); }

  function playContract(id) {
    const c = st.notebook.find((x) => x.id === id);
    const p = buildPuzzle(c);
    const spec = p.type === 'chain' ? { type: 'chain', ...chainLevels(p.chain, p.perm) } : p;
    const prices = marketOf(st).prices;
    const hints = { get: () => st.hints, use: () => { st.hints--; persist(); } };
    show((root) => playPuzzle(spec, {
      root, title: c.client, subtitle: `${TYPE_INFO[c.type].name} · ${townName(c.town)}`,
      prices, pieceCost: (t) => pieceCost(st, t), hints,
      onExit: () => {
        modal({ title: 'Quitter le contrat ?', body: '<p>Le contrat reste dans ton carnet ; tu pourras le reprendre plus tard.</p>',
          buttons: [{ label: 'Continuer', cls: 'ghost' }, { label: 'Quitter', cls: 'primary', onClick: rerender }] });
      },
      onWin: (res) => {
        const pay = payout(st, c, res.stars, res.cost);
        const r2 = complete(st, id, res.stars, res.cost);
        persist();
        play('coin');
        resultModal({
          title: 'Contrat rempli !', stars: res.stars,
          lines: [res.detail,
            `<span class="pay">Récompense (${Math.round(STAR_FACTOR[res.stars] * 100)} %) : <b>+${pay.gross}</b> or</span>`,
            `<span class="pay">Coût des matériaux : <b>−${pay.cost}</b> or</span>`,
            `<span class="pay total">Bénéfice : <b>${pay.net >= 0 ? '+' : ''}${pay.net}</b> or · Réputation <b>+${pay.rep}</b></span>`,
            ...r2.news.map((n) => `<span class="news">${esc(n)}</span>`)],
          buttons: [{ label: 'Retour à l\'atelier', cls: 'primary', onClick: () => { rerender(); if (st.ended) seasonEnd(); } }],
        });
      },
    }));
  }

  function seasonEnd() {
    modal({
      title: 'Fin de la saison', dismissable: false,
      body: `<div class="result"><p class="verdict">${seasonVerdict(st)}</p>
        <p>Or : <b>${st.gold}</b> · Réputation : <b>${st.rep}</b></p><p>Score final : <b>${finalScore(st)}</b></p>
        <p class="muted">${st.stats.done} contrats, ${st.stats.stars} étoiles.</p></div>`,
      buttons: [
        { label: 'Nouvelle carrière', cls: 'ghost', onClick: () => show(CareerScreen, { fresh: true, onHome: params.onHome }) },
        { label: 'Continuer (libre)', cls: 'primary', onClick: () => { continueFree(st); persist(); rerender(); } },
      ],
    });
  }

  v.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-act="home"]')) return params.onHome();
    const tb = t.closest('[data-tab]');
    if (tb) { tab = tb.dataset.tab; play('select'); return rerender(); }
    const ac = t.closest('[data-accept]');
    if (ac) {
      const err = accept(st, ac.dataset.accept);
      if (err) { toast(err, 'warn'); play('error'); return; }
      persist(); play('coin'); toast('Contrat ajouté au carnet.'); return rerender();
    }
    const pl = t.closest('[data-play]');
    if (pl) return playContract(pl.dataset.play);
    const ab = t.closest('[data-abandon]');
    if (ab) {
      const c = st.notebook.find((x) => x.id === ab.dataset.abandon);
      return confirmModal('Abandonner ?', `Tu perdras ${Math.ceil(c.rep / 2)} de réputation.`, () => { abandon(st, c.id); persist(); rerender(); }, 'Abandonner');
    }
    if (t.closest('[data-act="rest"]')) {
      return confirmModal('Passer la journée ?', 'Les offres du jour disparaissent et les échéances avancent.', () => {
        const news = nextDay(st); persist(); rerender(); showNews(news); if (st.ended) seasonEnd();
      }, 'Dormir');
    }
    const bu = t.closest('[data-buy]');
    if (bu) {
      const err = buyUpgrade(st, bu.dataset.buy);
      if (err) { toast(err, 'warn'); play('error'); return; }
      persist(); play('coin'); return rerender();
    }
    if (t.closest('[data-act="hints"]')) {
      const err = buyHints(st);
      if (err) { toast(err, 'warn'); return; }
      persist(); play('coin'); return rerender();
    }
    const tw = t.closest('[data-town]');
    if (tw) { const town = TOWNS.find((x) => x.id === tw.dataset.town); toast(`${town.name} : ${unlockedTowns(st).includes(town.id) ? town.desc : `réputation ${town.rep} requise.`}`); }
  });

  r.appendChild(v);
  if (st.ended) setTimeout(seasonEnd, 200);
  return { destroy() {} };
}
