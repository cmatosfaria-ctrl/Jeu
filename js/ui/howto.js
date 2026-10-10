// Écran « Comment jouer ».
import { el } from './dom.js';
import { ICON } from './icons.js';
import { pieceIcon } from './pipes-view.js';
import { chips, swatch } from './widgets.js';

export function HowTo(r, { onBack }) {
  const v = el(`<div class="screen menu howto">
    <header class="bar"><button class="icon-btn" data-act="back" aria-label="Retour">${ICON.back}</button><div class="bar-title"><strong>Comment jouer</strong></div></header>
    <div class="scroll prose">
      <section><h3>${ICON.flask} Le Dosage</h3>
        <p>Touche une <b>source</b> puis une <b>fiole</b> : la fiole se remplit <b>jusqu'en haut</b>. Touche une fiole puis une autre pour <b>verser</b> (jusqu'à ce que la première soit vide ou la seconde pleine). L'<b>évier</b> vide une fiole.</p>
        <p>Les liquides se mélangent comme de la peinture : Rouge + Jaune = Orange ${swatch([1, 1, 0, 0], 18)}, Rouge + Bleu = Violet ${swatch([1, 0, 1, 0], 18)}, Jaune + Bleu = Vert ${swatch([0, 1, 1, 0], 18)}, le Blanc éclaircit.</p>
        <p>Une commande ${chips([2, 1, 0, 0])} demande 2 parts de rouge pour 1 de jaune, avec <b>exactement</b> le volume indiqué. Choisis la fiole, puis touche la commande pour la livrer.</p>
        <p class="muted">Moins de coups = plus d'étoiles. L'optimum est calculé par un solveur.</p>
      </section>
      <section><h3>${ICON.pipe} La Tuyauterie</h3>
        <p>Pose des pièces depuis l'inventaire pour amener les sources jusqu'aux cuves. Touche une pièce posée pour la faire <b>pivoter</b>, appui long (ou outil Retirer) pour l'enlever.</p>
        <div class="pieces-demo">
          <div>${pieceIcon('S', 0)}<b>Séparateur</b><span>coupe un flux en deux moitiés</span></div>
          <div>${pieceIcon('M', 0)}<b>Mélangeur</b><span>réunit deux flux opposés</span></div>
          <div>${pieceIcon('X', 0)}<b>Croisement</b><span>deux flux qui se croisent sans se mêler</span></div>
        </div>
        <p>Chaque source débite 1. Aucune goutte ne doit fuir : l'excédent part à l'<b>évier</b>. Chaque cuve doit recevoir la bonne proportion. Exemple : ½ rouge + 1 jaune donne ${chips([1, 2, 0, 0])}.</p>
      </section>
      <section><h3>${ICON.chain} Les Chaînes de production</h3>
        <p>D'abord un réseau de tuyaux : ses cuves produisent des mélanges. Ces mélanges deviennent ensuite les <b>sources</b> d'un dosage final.</p>
      </section>
      <section><h3>🧪 Réactions alchimiques</h3>
        <p>Dans certains niveaux (badges en haut de l'écran), des pigments réagissent quand ils se <b>rencontrent pour la première fois</b> dans une fiole :</p>
        <ul>
          <li>🫧 <b>Mousse</b> — Jaune + Blanc : le volume double (le surplus déborde).</li>
          <li>♨ <b>Évaporation</b> — Rouge + Blanc : la moitié du liquide s'envole.</li>
          <li>❄ <b>Cristallisation</b> — Bleu + Blanc : le mélange se fige, on ne peut plus y verser ni en verser (mais on peut le livrer).</li>
          <li>💥 <b>Explosion</b> — Rouge + Jaune + Bleu : la fiole se vide d'un coup.</li>
        </ul>
      </section>
      <section><h3>${ICON.pipe} Pression & vannes</h3>
        <p>Touche une <b>vanne</b> pour l'ouvrir (anneau cyan) ou la fermer (anneau rouge). Si une sortie de séparateur est fermée, <b>tout</b> le flux part dans l'autre ; un mélangeur dont une entrée est coupée laisse passer l'autre flux seul.</p>
        <p>Dans les niveaux <b>sous pression</b>, un tuyau ordinaire supporte un débit de 1 : au-delà il cède. Les tuyaux <b>renforcés</b> (laiton cerclé), les vannes et les moyeux supportent 2.</p>
      </section>
      <section><h3>${ICON.clock} Contre-la-montre</h3>
        <p>2 minutes au départ. Chaque dosage réussi rapporte des points et des secondes ; résoudre à l'optimum fait grimper le <b>combo</b>. Passer une énigme coûte 10 secondes.</p>
      </section>
      <section><h3>${ICON.shop} La Carrière</h3>
        <p>Tu as ${30} jours pour faire de ton atelier le plus réputé du royaume.</p>
        <ul>
          <li>Accepte des <b>contrats</b> (carnet limité) en surveillant leurs <b>échéances</b> : un retard coûte de la réputation.</li>
          <li>Chaque contrat réalisé prend <b>une journée</b>. Tu es payé selon tes étoiles, <b>moins le coût</b> des pigments (prix du marché du jour) ou des pièces.</li>
          <li>La <b>réputation</b> ouvre de nouvelles villes, mieux payées.</li>
          <li>À l'<b>atelier</b>, achète pigments, licences de pièces, fioles et alambic pour accéder à plus de contrats.</li>
        </ul>
      </section>
    </div></div>`);
  v.querySelector('[data-act="back"]').onclick = onBack;
  r.appendChild(v);
}
