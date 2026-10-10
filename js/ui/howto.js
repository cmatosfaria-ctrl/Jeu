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
