# Alchimie : l'Atelier

Jeu de réflexion et de stratégie pour téléphone (Android), en français, jouable **hors-ligne**.
Univers **néo-vapeur** : cuivre, laiton et rivets (steampunk) éclairés de néons cyan et magenta (cyberpunk).
Tu diriges l'atelier d'un alchimiste : tu mesures et mélanges des liquides, tu construis des réseaux de tuyaux
et tu gères ton commerce pour devenir **Grand Alchimiste** du royaume.

## Les modes de jeu

| Mode | Principe |
| --- | --- |
| **Dosage** | Fioles de capacités différentes, sources de couleur, évier. Une source remplit une fiole *jusqu'en haut* ; on verse d'une fiole à l'autre. Il faut livrer un volume exact avec des proportions exactes (ex. 4 doses de Rouge 1 : Jaune 1). Un solveur calcule le nombre de coups optimal → étoiles. |
| **Tuyauterie** | Grille où l'on pose des tuyaux, coudes, croisements, **séparateurs** (coupent un flux en deux moitiés) et **mélangeurs**. Chaque cuve doit recevoir la bonne proportion, sans aucune fuite (le surplus part à l'évier). |
| **Chaîne de production** | Hybride : un réseau de tuyaux fabrique des mélanges qui deviennent les sources d'un dosage final. |
| **Carrière** | 30 jours pour faire prospérer l'atelier : contrats de 4 villes (échéances, carnet limité), or et réputation, marché des pigments qui fluctue, améliorations à acheter (pigments, licences de pièces, 3ᵉ fiole, grand alambic…). Chaque contrat est une énigme des modes ci-dessus. |
| **Grimoire d'énigmes** | 40 niveaux de dosage, 15 de tuyauterie, 12 chaînes, avec tutoriels. |
| **Défi du jour** | Une nouvelle énigme chaque jour, avec série de jours consécutifs. |

## Installer le jeu sur Android

1. Activer GitHub Pages pour ce dépôt : **Settings → Pages → Build and deployment → Source : « GitHub Actions »**.
   (Sur un compte gratuit, GitHub Pages exige un dépôt **public**.)
2. Chaque envoi sur la branche par défaut lance les tests puis publie le jeu (onglet **Actions**).
   L'adresse s'affiche dans l'onglet Actions et dans Settings → Pages (de la forme `https://<utilisateur>.github.io/<dépôt>/`).
3. Sur le téléphone, ouvrir cette adresse dans **Chrome**, puis menu **⋮ → « Ajouter à l'écran d'accueil »** (ou « Installer l'application »).
   Le jeu s'ouvre alors en plein écran, avec son icône, et fonctionne sans connexion.

## Développement

Aucune dépendance ni étape de compilation : HTML, CSS et modules JavaScript.

```bash
npm test                         # tests (Node 22) : moteurs, solveur, niveaux, carrière
npm run levels                   # régénère js/data/levels-data.js (niveaux de dosage, chaînes, contrats)
python3 -m http.server 8000      # puis ouvrir http://localhost:8000
```

Organisation :

- `js/core/` — fractions exactes, couleurs (mélange peintre RYB), générateur pseudo-aléatoire.
- `js/dosage/` — moteur, solveur (BFS 0-1) et générateur de niveaux de dosage.
- `js/pipes/` — pièces, simulation des flux, format des niveaux (la carte ASCII *est* la solution de référence), niveaux faits main.
- `js/chain/`, `js/career/` — chaînes de production, règles de la carrière (contrats, marché, améliorations).
- `js/ui/` — écrans et vues de jeu.
- `tools/` — génération des niveaux et des icônes.
- `fonts/` — polices Orbitron, Rajdhani et Share Tech Mono (licence OFL), embarquées pour le hors-ligne.

À chaque modification des fichiers du jeu, incrémenter `VERSION` dans `sw.js` pour que les téléphones récupèrent la mise à jour.
