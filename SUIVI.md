# Suivi de réalisation

> Dernière mise à jour : 2026-11-01
> Références : [SPEC.md](SPEC.md) (fonctionnel), [SPEC-TECHNIQUE.md](SPEC-TECHNIQUE.md) (technique).
> En ligne : https://www.sebastien-fauvart.fr/teleprompteur/

## 1. État d'avancement

| Lot | État |
|---|---|
| **P1** (MVP) + **F28** (lien de partage) | ✅ Implémenté, testé, déployé |
| **P2** — F29 Google Drive, F40 à F44 | ✅ Implémenté et testé avec Google simulé ; F29 à valider avec un vrai compte Google (§4.3) ; sections F43 reportées à F56 |
| **P3** — F56 Markdown, F50 à F57 | ⏳ À faire |
| Mise en ligne GitHub Pages | ✅ Déploiement automatique à chaque push sur `main` |

## 2. Ce qui a été fait

### 2.1 Fonctionnalités

| Réf. | Fonctionnalité | État | Remarques |
|---|---|---|---|
| F1 | Éditeur de texte | ✅ | CodeMirror 6, hauteur auto, compteur de mots et durée estimée en direct. Texte stocké tel quel (Markdown brut). |
| F2 | Lancement du prompteur | ✅ | Bouton et Ctrl/Cmd+Entrée ; message d'erreur si texte vide. |
| F3 | Affichage du prompteur | ✅ | Zone de lecture, triangles repères, texte démarrant juste sous le haut de la zone. Césure française automatique. |
| F4 | Barre de contrôles | ✅ | Menu « ⋯ » pour les commandes secondaires sous 640 px. |
| F5 | Vitesse (mots/min ou px/s) | ✅ | Conversion à rythme constant au changement d'unité, équivalent affiché, bornage et pas. |
| F6 | Taille du texte | ✅ | Ligne en cours conservée lors du changement (ancrage par bloc) ; pincement au doigt. |
| F7 | Miroir / inversion | ✅ | État des interrupteurs toujours cohérent avec l'affichage. |
| F8 | Temps écoulé / durée estimée | ✅ | Formules de la spec technique §7.5. |
| F9 | Lecture / pause / stop / fin | ✅ | Indicateur « Fin » ; l'enregistrement audio s'arrête en fin de texte. |
| F10 | Enregistrement audio | ✅ | WebM/M4A/OGG selon le navigateur ; partage natif sur mobile, téléchargement sinon. |
| F11 | Plein écran et fermeture | ✅ | Bouton masqué si l'API est absente (iPhone). |
| F20–F22 | Prompts sauvegardés, bibliothèque, enregistrer / enregistrer sous | ✅ | Recherche sans accents, 4 tris, renommer, dupliquer, exporter, copier le lien, supprimer. |
| F23 | Protection contre la perte | ✅ | Brouillon conservé ; confirmation Enregistrer / Ne pas enregistrer / Annuler ; détection de modification depuis un autre onglet. |
| F24 | Import / export | ✅ | JSON (prompt ou bibliothèque), .md, .txt ; validation complète avant écriture. |
| F25 | Reprise de lecture | ✅ | Proposée à l'ouverture si le texte n'a pas changé. |
| F26 | Confidentialité | ✅ | Aucune requête réseau hors Google Drive ; CSP stricte ; page `confidentialite.html`. |
| F27 | Préférences / réglages par défaut | ✅ | Vitesse, taille, miroir, audio, et tous les réglages d'affichage. Voir écart n° 9. |
| F28 | Lien de partage `#prompt=` | ✅ | fflate + base64url, seuils 8 000 / 64 000 caractères, décompression bornée à 1 Mo. |
| F29 | Google Drive | ✅* | Menu « Google Drive » (éditeur), action dans la bibliothèque, section dans les Préférences. Enregistrer (dossier « Téléprompteur », conflit, lecture seule, fichier supprimé), ouvrir (liste des fichiers de l'application ou sélecteur Google), lien `#gdrive=` (public, puis connexion, puis sélecteur), rendre public par lien, indicateur « Drive : modifié ». *Testé uniquement avec Google simulé. |
| F30 | Raccourcis clavier | ✅ | Aide intégrée (touche `?`). |
| F31 | Défilement manuel, toucher, pincement | ✅ | Via `@use-gesture/react`. |
| F32 | Télécommandes / pédales | ✅ | Par les touches standard (non testé avec un vrai matériel). |
| F33 | Barre masquable | ✅ | Touche H et masquage auto après 3 s de lecture. |
| F40 | Compte à rebours | ✅ | 0 à 10 s (3 s par défaut) avant le démarrage d'une session ; Espace ou toucher pour annuler. |
| F41 | Mise en forme de l'affichage | ✅ | Panneau « Affichage et lecture » dans le prompteur et dans les Préférences : 3 thèmes, couleurs (texte, fond, indications), police (4 polices système), interligne, largeur, alignement, position, hauteur et surbrillance de la zone de lecture. |
| F42 | Barre de progression | ✅ | En bas de l'écran, mise à jour à chaque image, cliquable. |
| F43 | Indications scéniques | ✅ / ⏳ | `[…]` colorées dans l'éditeur et le prompteur, exclues du décompte. **Sections** (sauts ← / → par titre ou séparateur) reportées à F56, qui introduit titres et séparateurs. |
| F44 | Durée cible | ✅ | Saisie dans l'éditeur (« 3 », « 2:30 », « 2 min 30 »…), vitesse proposée (avec avertissement hors plage), bilan « durée réelle / cible / écart » en fin de lecture. |
| Appareils | Mise en page adaptative, wake lock, orientation | ✅ | Écran maintenu allumé pendant la lecture. |

### 2.2 Technique

- **Stack** : Vite 8, React 19, TypeScript 6.0 (strict), zustand, Dexie (IndexedDB), zod 4, fflate, CodeMirror 6, `@use-gesture/react`, vite-plugin-pwa (Workbox).
- **Architecture** conforme à la spec technique §4 : `domain/` (logique pure), `storage/`, `stores/`, `services/` (dont `services/google/`), `features/`, `ui/`, plus `app/` (routeur, actions transverses, actions Drive, service worker).
- **Moteur de défilement** (`src/features/prompter/engine/scrollEngine.ts`) : `requestAnimationFrame`, pas de temps plafonné à 100 ms, aucun re-rendu React par image, ancrage par bloc lors des changements de mise en page, ligne de départ liée à la zone de lecture, barre de progression pilotée sans React.
- **Google Drive** (`src/services/google/`, `src/app/driveActions.ts`) : Google Identity Services (jeton en mémoire uniquement), API REST Drive v3 en `fetch` direct, Google Picker ; scripts Google chargés à la première utilisation.
- **PWA** : précache complet, fonctionnement hors ligne vérifié, proposition de mise à jour, `updateViaCache: 'none'`, base `/teleprompteur/`.
- **CSP** en `<meta>` (production uniquement), avec un nonce généré à chaque build pour les styles de CodeMirror et zod en mode `jitless` (pas d'`eval`).
- **CI / déploiement** : `.github/workflows/ci.yml` (PR et branches) et `deploy.yml` (push sur `main` → branche `gh-pages`). Identifiants Google lus dans `.env.local` en local et dans les variables du dépôt sur GitHub.

### 2.3 Vérifications effectuées (2026-11-01)

| Vérification | Résultat |
|---|---|
| `npm run lint`, `npm run format:check`, `npm run typecheck` | ✅ OK |
| `npm test` (Vitest) | ✅ 80 tests passés (domaine, moteur, store, stockage, import/export, client Drive) |
| `npm run build` | ✅ 814 Ko JS (258 Ko gzip, budget 300 Ko) |
| `npm run test:e2e` — Chromium, Android émulé, Firefox | ✅ 48 passés, 12 ignorés volontairement (tests propres à l'ordinateur ou au mobile) ; parcours Drive avec Google simulé |
| `npm run test:e2e` — WebKit, iPad émulé | ⚠️ Non exécutés en local (dépendances système absentes) ; jobs « expérimentaux » dans la CI |
| Déploiement GitHub Pages | ✅ Workflow `deploy.yml` réussi, site en ligne |

## 3. Écarts par rapport à la spec technique

| # | Spec | Réalisé | Raison |
|---|---|---|---|
| 1 | `react-router` (mode hash) | Petit routeur maison (`src/app/router.ts`) | 4 routes seulement : une dépendance de moins. |
| 2 | CSS Modules | Feuille de styles globale (`src/styles/global.css`) avec variables CSS | Plus simple à ce stade ; migration possible. |
| 3 | `domain/markdown/` | `domain/blocks.ts` et `domain/text.ts` | Pas de Markdown interprété avant F56. |
| 4 | Barre de contrôles au-dessus de la surface, `H` recalculé quand elle est masquée | Barre superposée à la surface | Évite un saut du texte au masquage. |
| 5 | Action `peaceiris/actions-gh-pages` | Publication par commandes `git` dans le workflow | Aucune action tierce à figer. |
| 6 | TypeScript « dernière version » | TypeScript 6.0.3 | `typescript-eslint` 8.72 n'accepte pas TypeScript 7. |
| 7 | CSP `style-src 'self'` | `style-src 'self' 'nonce-…'` | CodeMirror injecte ses styles de base dans une balise `<style>`. |
| 8 | Conflits d'import : choix par prompt + « Appliquer à tous » | Un seul choix pour tous les conflits | Simplification. |
| 9 | « Définir comme paramètres par défaut » depuis un prompt existant | Bouton « Utiliser les réglages du prompt en cours » dans les Préférences | Pas encore d'action depuis la carte de la bibliothèque. |
| 10 | Plein écran sur l'élément du prompteur | Plein écran sur toute la page | Dialogues et notifications restent visibles en plein écran. |
| 11 | `columnWidth` « en ch ou % » | En % de la largeur disponible (30–100 %, max. 1 320 px) | Indépendant de la taille de police. |
| 12 | Préférence « connecté à Drive » en IndexedDB | Indicateur dans `localStorage` (sans jeton) | Simple commodité par navigateur. |
| 13 | Ouverture d'un fichier Drive déjà lié à un prompt local | Le prompt local est ouvert avec le contenu Drive (état « modifié » s'il diffère) | Évite les doublons dans la bibliothèque. |

## 4. Reste à faire

### 4.1 Points à trancher

1. **Taille de texte par défaut sur smartphone** : 80 px (réglage 10 × 8) ne laisse que 5 à 6 caractères par ligne sur un téléphone. Proposition : taille par défaut dépendant de la largeur d'écran, ou taille relative à la largeur.
2. **Décompte des mots** : `Intl.Segmenter` compte « c'est », « l'été » comme un seul mot. Acceptable pour estimer une durée ?

### 4.2 Fonctionnalités

| Réf. | Priorité | À faire |
|---|---|---|
| F43 | P2 | Sections (titres, séparateurs) comme points de saut ← / → : avec F56. |
| F56 | P3 | Markdown : `@codemirror/lang-markdown`, surlignage `==…==`, barre d'outils ; rendu `markdown-it` dans le prompteur ; `toPlainText` sans syntaxe ; couleur de surlignage (`theme.highlight`, déjà dans le schéma). |
| F50–F55, F57 | P3 | Idées à valider. |
| F27 | — | Action « Définir comme paramètres par défaut » depuis la bibliothèque. |
| F24 | — | Choix des conflits prompt par prompt. |

### 4.3 Qualité et vérifications

- **Google Drive avec un vrai compte** (à faire par le propriétaire, sur le site en ligne ou avec `npm run dev` sur http://localhost:5173/teleprompteur/) : connexion, enregistrement, liste, sélecteur Google, lien `#gdrive=` public et privé, conflit (modifier le fichier depuis un autre appareil). Vérifier en production qu'aucune violation de CSP n'apparaît dans la console (sources Google du sélecteur notamment) et ajuster `vite.config.ts` si besoin.
- **Écran de consentement Google** : vérifier qu'il est publié en production (sinon seuls les comptes de test peuvent se connecter).
- **Tests sur appareils réels** : Safari iOS / iPadOS (plein écran absent, wake lock, audio M4A, feuille de partage, stockage séparé de l'app installée, fenêtre de connexion Google), Chrome Android (gestes, pincement), télécommande ou pédale Bluetooth.
- **WebKit en CI** : vérifier le passage des jobs `webkit` et `tablet-ipad`, puis retirer `continue-on-error`.
- **Tests de bout en bout manquants** : reprise de lecture (F25), import/export de fichiers, gestes tactiles, conflits Drive (fichier modifié ailleurs, lecture seule).
- **Accessibilité** : audit automatisé (axe) et lecteur d'écran.
- **Performance** : mesurer 60 images/s sur une tablette avec 5 000 mots à 160 px ; envisager le chargement différé de CodeMirror si le budget du bundle devient serré.
- **Libellés** : quelques libellés d'accessibilité sont encore écrits en dur hors de `i18n/fr.ts` (navigation, barre d'outils, titre du sélecteur Google).
