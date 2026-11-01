# Suivi de réalisation

> Dernière mise à jour : 2026-11-01
> Références : [SPEC.md](SPEC.md) (fonctionnel), [SPEC-TECHNIQUE.md](SPEC-TECHNIQUE.md) (technique).

## 1. État d'avancement

| Lot | État |
|---|---|
| **P1** (MVP) + **F28** (lien de partage) | ✅ Implémenté et testé (voir §2) |
| **P2** — F29 Google Drive, F40 à F44 | ⏳ À faire (le schéma des réglages est prêt) |
| **P3** — F56 Markdown, F50 à F57 | ⏳ À faire |
| Mise en ligne GitHub Pages | ⏳ Workflow prêt, à activer (voir §5) |

## 2. Ce qui a été fait

### 2.1 Fonctionnalités

| Réf. | Fonctionnalité | État | Remarques |
|---|---|---|---|
| F1 | Éditeur de texte | ✅ | CodeMirror 6, hauteur auto, compteur de mots et durée estimée en direct. Texte stocké tel quel (Markdown brut). |
| F2 | Lancement du prompteur | ✅ | Bouton et Ctrl/Cmd+Entrée ; message d'erreur si texte vide. |
| F3 | Affichage du prompteur | ✅ | Zone de lecture 32–70 %, triangles repères, texte démarrant à 35 %. Césure française automatique. |
| F4 | Barre de contrôles | ✅ | Menu « ⋯ » pour les commandes secondaires sous 640 px. |
| F5 | Vitesse (mots/min ou px/s) | ✅ | Conversion à rythme constant au changement d'unité, équivalent affiché, bornage et pas. |
| F6 | Taille du texte | ✅ | Ligne en cours conservée lors du changement (ancrage par bloc) ; pincement au doigt. |
| F7 | Miroir / inversion | ✅ | État des interrupteurs toujours cohérent avec l'affichage. |
| F8 | Temps écoulé / durée estimée | ✅ | Formules de la spec technique §7.5. |
| F9 | Lecture / pause / stop / fin | ✅ | Indicateur « Fin » ; l'enregistrement audio s'arrête en fin de texte. |
| F10 | Enregistrement audio | ✅ | WebM/M4A/OGG selon le navigateur ; partage natif sur mobile, téléchargement sinon. |
| F11 | Plein écran et fermeture | ✅ | Bouton masqué si l'API est absente (iPhone). |
| F20–F22 | Prompts sauvegardés, bibliothèque, enregistrer / enregistrer sous | ✅ | Recherche sans accents, 4 tris, renommer, dupliquer, exporter, copier le lien, supprimer. |
| F23 | Protection contre la perte | ✅ | Brouillon conservé (500 ms + masquage de page) ; confirmation Enregistrer / Ne pas enregistrer / Annuler ; détection de modification depuis un autre onglet. |
| F24 | Import / export | ✅ | JSON (prompt ou bibliothèque), .md, .txt ; validation complète avant écriture. |
| F25 | Reprise de lecture | ✅ | Proposée à l'ouverture si le texte n'a pas changé. |
| F26 | Confidentialité | ✅ | Aucune requête réseau ; CSP stricte ; page `confidentialite.html`. |
| F27 | Préférences / réglages par défaut | ✅ | Voir écart n° 9. |
| F28 | Lien de partage `#prompt=` | ✅ | fflate + base64url, seuils 8 000 / 64 000 caractères, décompression bornée à 1 Mo. |
| F29 | Google Drive | ❌ | Seule la reconnaissance de `#gdrive=` existe (message « pas encore disponible »). |
| F30 | Raccourcis clavier | ✅ | Aide intégrée (touche `?`). |
| F31 | Défilement manuel, toucher, pincement | ✅ | Via `@use-gesture/react`. |
| F32 | Télécommandes / pédales | ✅ | Par les touches standard (non testé avec un vrai matériel). |
| F33 | Barre masquable | ✅ | Touche H et masquage auto après 3 s de lecture. |
| Appareils | Mise en page adaptative, wake lock, orientation | ✅ | Écran maintenu allumé pendant la lecture. |

### 2.2 Technique

- **Stack** : Vite 8, React 19, TypeScript 6.0 (strict), zustand, Dexie (IndexedDB), zod 4, fflate, CodeMirror 6, `@use-gesture/react`, vite-plugin-pwa (Workbox).
- **Architecture** conforme à la spec technique §4 : `domain/` (logique pure), `storage/`, `stores/`, `services/`, `features/`, `ui/`, plus `app/` (routeur, actions transverses, service worker).
- **Moteur de défilement** (`src/features/prompter/engine/scrollEngine.ts`) : `requestAnimationFrame`, pas de temps plafonné à 100 ms, aucun re-rendu React par image, ancrage par bloc lors des changements de mise en page.
- **PWA** : précache complet, fonctionnement hors ligne vérifié, proposition de mise à jour, `updateViaCache: 'none'`, base `/teleprompteur/`.
- **CSP** en `<meta>` (production uniquement), avec un nonce généré à chaque build pour les styles de CodeMirror et zod en mode `jitless` (pas d'`eval`).
- **CI / déploiement** : `.github/workflows/ci.yml` (PR et branches) et `deploy.yml` (push sur `main` → branche `gh-pages`).

### 2.3 Vérifications effectuées (2026-11-01)

| Vérification | Résultat |
|---|---|
| `npm run lint`, `npm run format:check`, `npm run typecheck` | ✅ OK |
| `npm test` (Vitest) | ✅ 62 tests passés (domaine, moteur, store, stockage, import/export) |
| `npm run build` | ✅ 782 Ko JS (248 Ko gzip, budget 300 Ko) |
| `npm run test:e2e` — Chromium, Android émulé, Firefox | ✅ 27 passés, 9 ignorés volontairement (tests propres à l'ordinateur ou au mobile) |
| `npm run test:e2e` — WebKit, iPad émulé | ⚠️ Non exécutés : WebKit ne démarre pas sur le poste (dépendances système Ubuntu manquantes). Marqués « expérimentaux » dans la CI. |

## 3. Écarts par rapport à la spec technique

| # | Spec | Réalisé | Raison |
|---|---|---|---|
| 1 | `react-router` (mode hash) | Petit routeur maison (`src/app/router.ts`) | 4 routes seulement : une dépendance de moins. |
| 2 | CSS Modules | Feuille de styles globale (`src/styles/global.css`) avec variables CSS | Plus simple à ce stade ; migration possible. |
| 3 | `domain/markdown/` | `domain/blocks.ts` et `domain/text.ts` | Pas de Markdown interprété avant F56. |
| 4 | Barre de contrôles au-dessus de la surface, `H` recalculé quand elle est masquée | Barre superposée à la surface | Évite un saut du texte au masquage ; la barre ne couvre que le haut de l'écran, hors zone de lecture. |
| 5 | Action `peaceiris/actions-gh-pages` | Publication par commandes `git` dans le workflow | Aucune action tierce à figer. |
| 6 | TypeScript « dernière version » | TypeScript 6.0.3 | `typescript-eslint` 8.72 n'accepte pas TypeScript 7. |
| 7 | CSP `style-src 'self'` | `style-src 'self' 'nonce-…'` | CodeMirror injecte ses styles de base dans une balise `<style>`. |
| 8 | Conflits d'import : choix par prompt + « Appliquer à tous » | Un seul choix pour tous les conflits | Simplification. |
| 9 | « Définir comme paramètres par défaut » depuis un prompt existant | Bouton « Utiliser les réglages du prompt en cours » dans les Préférences | Pas encore d'action depuis la carte de la bibliothèque. |
| 10 | Plein écran sur l'élément du prompteur | Plein écran sur toute la page | Les dialogues et notifications restent visibles en plein écran. |

## 4. Reste à faire

### 4.1 Points à trancher

1. **Taille de texte par défaut sur smartphone** : 80 px (réglage 10 × 8) ne laisse que 5 à 6 caractères par ligne sur un téléphone ; les mots longs sont coupés. Proposition : taille par défaut dépendant de la largeur d'écran, ou taille exprimée relativement à la largeur.
2. **Décompte des mots** : `Intl.Segmenter` compte « c'est », « l'été » comme un seul mot. Acceptable pour estimer une durée ? (sinon, découper sur les apostrophes).

### 4.2 Fonctionnalités

| Réf. | Priorité | À faire |
|---|---|---|
| F29 | P2 | Google Drive : `services/google/*` (auth GIS, REST Drive v3, Picker), chargement `#gdrive=`, enregistrement / ouverture / conflits, section Drive dans les Préférences. Nécessite la configuration Google Cloud (§5). |
| F40 | P2 | Compte à rebours (réglage `countdownSec` déjà dans le schéma, non utilisé). |
| F41 | P2 | Interface de mise en forme : couleurs, interligne, largeur de colonne, alignement, position de la zone, police. Le prompteur applique déjà couleur du texte, fond, interligne et zone de lecture depuis les réglages. |
| F42 | P2 | Barre de progression cliquable. |
| F43 | P2 | Indications scéniques `[…]` en couleur distincte (déjà exclues du décompte des mots) ; sections pour les sauts ← / →. |
| F44 | P2 | Durée cible → vitesse proposée ; écart affiché en fin de lecture. |
| F56 | P3 | Markdown : `@codemirror/lang-markdown`, surlignage `==…==`, barre d'outils ; rendu `markdown-it` dans le prompteur ; `toPlainText` sans syntaxe. |
| F50–F55, F57 | P3 | Idées à valider. |
| F27 | — | Action « Définir comme paramètres par défaut » depuis la bibliothèque. |
| F24 | — | Choix des conflits prompt par prompt. |

### 4.3 Qualité et vérifications

- **Tests sur appareils réels** : Safari iOS / iPadOS (plein écran absent, wake lock, audio M4A, feuille de partage, stockage séparé de l'app installée), Chrome Android (gestes, pincement), télécommande ou pédale Bluetooth.
- **WebKit en CI** : vérifier le premier passage des jobs `webkit` et `tablet-ipad`, puis retirer `continue-on-error`.
- **Tests de bout en bout manquants** : reprise de lecture (F25), import/export de fichiers, gestes tactiles, conflit d'enregistrement entre onglets.
- **Accessibilité** : audit automatisé (axe) et lecteur d'écran.
- **Performance** : mesurer 60 images/s sur une tablette avec 5 000 mots à 160 px ; envisager le chargement différé de CodeMirror si le budget du bundle devient serré.
- **Libellés** : quelques libellés d'accessibilité sont encore écrits en dur hors de `i18n/fr.ts` (navigation, barre d'outils).
- **Versions des actions GitHub** (`checkout@v5`, `setup-node@v5`, `upload/download-artifact@v4`) : à confirmer au premier passage de la CI.

## 5. Prérequis à la charge du propriétaire

| # | Action | Pour |
|---|---|---|
| 1 | Pousser sur `main` : le workflow `deploy.yml` crée la branche `gh-pages` | Mise en ligne |
| 2 | Réglages du dépôt → Pages → « Deploy from a branch », branche `gh-pages`, dossier `/ (root)` | Mise en ligne |
| 3 | Vérifier https://www.sebastien-fauvart.fr/teleprompteur/ | Mise en ligne |
| 4 | Projet Google Cloud, écran de consentement, identifiant client OAuth, clé d'API (spec technique §6.6) | F29 |
| 5 | Variables de dépôt `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, `VITE_GOOGLE_APP_ID` | F29 |
