# Téléprompteur local — Spécification technique

> Version 0.1 — 2026-11-01
> Ce document décrit **comment** réaliser l'application décrite dans [SPEC.md](SPEC.md) (spécification fonctionnelle). Les identifiants `Fxx` renvoient aux fonctionnalités de cette dernière.

---

## 1. Choix structurants

| Sujet | Choix | Raison principale |
|---|---|---|
| Type d'application | **PWA** (Progressive Web App) : application web statique, installable, fonctionnant hors ligne | Un seul code pour ordinateur, tablette et smartphone. |
| Hébergement | **GitHub Pages** (branche `gh-pages` du dépôt `sfauvart/teleprompteur`), servi sur **https://www.sebastien-fauvart.fr/teleprompteur/** — cf. §15 | HTTPS obligatoire pour le micro, le service worker et l'installation ; aucun serveur applicatif. |
| Langage / framework | **TypeScript** (mode strict) + **React** | Choix du projet. |
| Outil de build | **Vite** | Standard de fait pour React, build statique simple. |
| Stockage | **IndexedDB** via **Dexie** | Stockage local volumineux, requêtable, transactionnel. |
| Éditeur | **CodeMirror 6** en mode « source stylée » | Robuste au tactile et aux claviers virtuels ; le texte stocké est exactement le Markdown saisi. |
| Rendu Markdown | **markdown-it** (HTML désactivé) + rendu en éléments React | Sous-ensemble configurable, aucune injection de HTML. |
| Lien de partage (F28) | Prompt sérialisé en JSON, compressé avec **fflate** (DEFLATE), encodé en base64url dans le fragment `#prompt=` | Meilleur taux de compression que les encodeurs spécialisés URL sur du texte ; fragment jamais transmis au serveur. |
| Google Drive (F29) | **Google Identity Services** (jeton OAuth côté navigateur) + **API REST Drive v3** + **Google Picker** ; portée `drive.file` | Aucun serveur nécessaire ; portée minimale, limitée aux fichiers créés ou ouverts par l'application. |

**Principe directeur : zéro serveur applicatif.** L'hébergeur ne sert que des fichiers statiques. Une fois chargée, l'application ne fait **aucune requête réseau** (pas d'analytics, pas de police ou script tiers), **à l'exception des appels à Google**, uniquement lorsque l'utilisateur utilise une fonction Google Drive (F29) ou ouvre un lien `#gdrive=`. Les scripts Google ne sont chargés qu'à ce moment-là. Toutes les autres données restent dans le navigateur de l'appareil (F26).

---

## 2. Navigateurs et appareils supportés

| Plateforme | Navigateurs |
|---|---|
| Ordinateur | Chrome, Edge, Firefox, Safari — 2 dernières versions majeures |
| Tablette / smartphone | Safari iOS / iPadOS 17+, Chrome Android (2 dernières versions) |

Dégradations acceptées, détectées à l'exécution (*feature detection*, jamais par analyse du user-agent) :

| API | Indisponible sur | Comportement |
|---|---|---|
| Fullscreen API | Safari iPhone | Bouton plein écran masqué (`document.fullscreenEnabled`, avec repli `webkitFullscreenEnabled` pour iPadOS). |
| Screen Wake Lock API | Navigateurs anciens | Pas de maintien de l'écran allumé ; aucun message bloquant. |
| `MediaRecorder` / micro | Contexte non sécurisé, refus utilisateur | Interrupteur audio désactivé avec message explicatif (F10). |
| Web Share API (fichiers) | Ordinateur en général | Repli sur le téléchargement classique (§9.3). |

---

## 3. Stack et dépendances

Versions indicatives au 2026-11-01, à figer (versions exactes dans `package.json` + lockfile) lors de l'initialisation du projet, en vérifiant la compatibilité croisée (notamment `vite-plugin-pwa` ↔ Vite, `typescript-eslint` ↔ TypeScript).

| Rôle | Paquet | Version indicative |
|---|---|---|
| UI | `react`, `react-dom` | 19.x |
| Langage | `typescript` | dernière version supportée par `typescript-eslint` |
| Build / dev | `vite`, `@vitejs/plugin-react` | 8.x |
| PWA | `vite-plugin-pwa` (Workbox) | 2.x |
| Routage | `react-router` (mode *hash*) | 8.x |
| État applicatif | `zustand` | 5.x |
| Stockage | `dexie`, `dexie-react-hooks` | 4.x |
| Validation (import, données lues) | `zod` | 4.x |
| Éditeur | `codemirror`, `@codemirror/lang-markdown`, `@codemirror/view`, `@codemirror/state` | 6.x |
| Rendu Markdown | `markdown-it`, `markdown-it-mark` | 15.x / 4.x |
| Compression des liens | `fflate` | 0.8.x |
| Types Google (développement) | `@types/google.accounts`, `@types/google.picker`, `@types/gapi` | — |
| Gestes tactiles | `@use-gesture/react` | 10.x |
| Tests unitaires / composants | `vitest`, `@testing-library/react`, `fake-indexeddb` | 5.x / 16.x / 6.x |
| Tests de bout en bout | `@playwright/test` | 1.x |
| Qualité | `eslint`, `typescript-eslint`, `prettier` | — |

Scripts Google chargés dynamiquement depuis Google (non empaquetés, non disponibles sur npm) : `https://accounts.google.com/gsi/client` (authentification) et `https://apis.google.com/js/api.js` (chargeur du Picker). Les appels à l'API Drive se font en `fetch` direct sur l'API REST, sans client `gapi`.

Pas de bibliothèque de composants UI : composants maison légers (boutons, interrupteurs, champ numérique à pas, `<dialog>` natif pour les modales), stylés en **CSS Modules** avec des **variables CSS** pour les thèmes (F41).

---

## 4. Architecture

### 4.1 Découpage en couches

```
┌─────────────────────────────────────────────────────────────┐
│  features/   écrans et composants React (éditeur, prompteur, │
│              bibliothèque, préférences)                      │
├───────────────────────────┬─────────────────────────────────┤
│  stores/  état applicatif │  services/  APIs navigateur     │
│  (zustand)                │  (audio, wake lock, plein écran,│
│                           │   téléchargement, partage)      │
├───────────────────────────┴─────────────────────────────────┤
│  storage/   accès IndexedDB (Dexie), import / export         │
├─────────────────────────────────────────────────────────────┤
│  domain/    logique pure, sans React ni navigateur :         │
│             vitesse, durée, mots, Markdown, réglages, noms   │
└─────────────────────────────────────────────────────────────┘
```

Règle de dépendance : une couche n'importe que les couches situées en dessous. `domain/` est 100 % pur et testé unitairement.

### 4.2 Arborescence

```
src/
  main.tsx                    point d'entrée, enregistrement du service worker
  App.tsx                     routes, layout, toasts
  domain/
    settings.ts               schéma zod des réglages, bornes, valeurs par défaut
    speed.ts                  conversions mots/min ↔ px/s, bornage, pas
    duration.ts               durée estimée, temps écoulé, formatage HH:MM:SS
    words.ts                  décompte des mots (Intl.Segmenter)
    markdown/                 configuration markdown-it, blocs, texte brut
    filename.ts               noms de fichiers (audio, export)
    search.ts                 normalisation (accents, casse) et filtrage
    shareLink.ts              encodage / décodage du fragment #prompt=
    sharedPrompt.ts           schéma zod du prompt partagé (lien, fichier Drive, export)
  storage/
    db.ts                     schéma Dexie et migrations
    promptsRepo.ts            CRUD des prompts
    draftRepo.ts              brouillon courant
    preferencesRepo.ts        préférences
    exchange.ts               import / export JSON, .md, .txt
  stores/
    sessionStore.ts           prompt en cours d'édition (brouillon, état « modifié »)
  services/
    audioRecorder.ts          MediaRecorder
    wakeLock.ts
    fullscreen.ts
    fileSaver.ts              téléchargement / partage de fichiers
    clipboard.ts              copie / partage natif de liens
    google/
      scriptLoader.ts         chargement à la demande des scripts Google
      auth.ts                 jeton OAuth (Google Identity Services)
      drive.ts                appels REST Drive v3
      picker.ts               sélecteur de fichiers Google
  boot/
    fragmentLoader.ts         traitement de #prompt= et #gdrive= au démarrage
  features/
    editor/                   EditorScreen, CodeMirror, barre d'outils Markdown
    prompter/
      engine/scrollEngine.ts  moteur de défilement (impératif, hors React)
      PrompterScreen.tsx
      Controls.tsx            barre de contrôles (+ menu sur petit écran)
      ReadingZone.tsx
      PrompterContent.tsx     rendu du texte en blocs
      useShortcuts.ts
      useGestures.ts
    library/                  LibraryScreen, carte de prompt, recherche, tri
    preferences/              PreferencesScreen
  ui/                         composants génériques
  i18n/fr.ts                  tous les libellés (préparation F57)
  styles/                     variables CSS, thèmes, reset
```

### 4.3 Routes

Routage en mode *hash* (`#/…`) : fonctionne sur GitHub Pages sans règle de réécriture, et le bouton « retour » d'Android ferme le prompteur.

| Route | Écran |
|---|---|
| `#/` | Éditeur (prompt courant) |
| `#/lecture` | Prompteur (prompt courant) |
| `#/prompts` | Bibliothèque |
| `#/preferences` | Préférences |

Ouvrir ou lancer un prompt depuis la bibliothèque le charge dans le `sessionStore` puis navigue vers `#/` ou `#/lecture`.

**Fragments de restauration** (§6.5, §6.6) : les fragments `#prompt=…` et `#gdrive=…` ne commencent pas par `/` et ne sont donc pas des routes. Ils sont interceptés par `boot/fragmentLoader.ts` **avant le montage du routeur**, puis l'adresse est remplacée par `#/` via `history.replaceState` (pas d'entrée d'historique, et le rechargement de la page ne rejoue pas le chargement).

---

## 5. Modèle de données

### 5.1 Types

```ts
type SpeedUnit = 'wpm' | 'pxps';

interface PromptSettings {
  speed: { unit: SpeedUnit; value: number }; // wpm : 60–250 pas 5 ; pxps : 4–200 pas 4
  fontSize: number;                           // 1–20 (× 8 px)
  mirrorX: boolean;
  mirrorY: boolean;
  recordAudio: boolean;
  // P2 (F40, F41, F44) — présents dans le schéma dès la v1, avec valeurs par défaut
  countdownSec: number;                       // 0–10
  theme: { text: string; background: string; highlight: string };
  lineHeight: number;
  columnWidth: number;                        // en ch ou % — à préciser en P2
  align: 'left' | 'center';
  readingZone: { top: number; bottom: number; opacity: number }; // fractions de hauteur
  font: string;
  targetDurationSec: number | null;
}

interface ReadingPosition {
  blockIndex: number;   // bloc (paragraphe) en face de la ligne de lecture
  fraction: number;     // 0–1, position dans ce bloc
  textHash: string;     // empreinte du texte au moment de la sauvegarde
}

interface Prompt {
  id: string;           // crypto.randomUUID()
  title: string;
  text: string;         // source Markdown
  settings: PromptSettings;
  lastPosition: ReadingPosition | null;
  stats: { wordCount: number; estimatedDurationSec: number };
  drive: DriveLink | null;  // F29
  createdAt: string;    // ISO 8601
  updatedAt: string;
  lastUsedAt: string | null;
}

interface DriveLink {
  fileId: string;
  modifiedTime: string;   // modifiedTime Drive lors du dernier envoi / chargement
  contentHash: string;    // empreinte (titre + texte + réglages) envoyée
  canEdit: boolean;       // droit d'écriture de l'utilisateur (capabilities.canEdit)
}

interface Draft {
  id: 'current';
  promptId: string | null;    // null = prompt jamais enregistré
  title: string;
  text: string;
  settings: PromptSettings;
  baseUpdatedAt: string | null; // updatedAt du prompt enregistré au chargement
  drive: DriveLink | null;      // conservé quand le prompt vient d'un lien #gdrive=
}

interface Preferences {
  id: 'default';
  defaultSettings: PromptSettings;
  driveFolderId: string | null; // dossier « Téléprompteur » créé dans le Drive
}

// Format commun au lien #prompt=, aux fichiers Drive et aux exports (§6.4)
interface SharedPrompt {
  title: string;
  text: string;
  settings: PromptSettings;
}
```

### 5.2 Réglages : schéma, bornes, valeurs par défaut

- `domain/settings.ts` définit un **schéma zod** unique dont chaque champ porte sa valeur par défaut (`.default(...)`) et ses bornes.
- Toute donnée lue (base, import) passe par ce schéma : un champ manquant prend sa valeur par défaut, une valeur hors bornes est ramenée à la borne. Ajouter un réglage en P2 ne demande donc **aucune migration** de données.
- Valeurs par défaut : vitesse 140 mots/min, taille 10, miroir et inversion désactivés, audio désactivé, compte à rebours 3 s, thème blanc sur noir, alignement gauche, zone de lecture 32 %–70 % à 8 % d'opacité.

### 5.3 Base IndexedDB (Dexie)

Base `teleprompteur`, version 1 :

| Table | Clé / index | Contenu |
|---|---|---|
| `prompts` | `id`, index `updatedAt`, `lastUsedAt`, `title` | Prompts enregistrés |
| `draft` | `id` (ligne unique `current`) | Brouillon courant (F23) |
| `preferences` | `id` (ligne unique `default`) | Préférences (F27) |

- Les évolutions de schéma passent par `db.version(n).stores(...).upgrade(...)`.
- Au premier enregistrement d'un prompt, l'application appelle `navigator.storage.persist()` pour demander un stockage persistant (non évacuable par le navigateur).

### 5.4 Limites du stockage navigateur

- Vider les données du site efface les prompts : un message dans les Préférences le rappelle et invite à **exporter** régulièrement (F24).
- Sur Safari (iOS/macOS), les données d'un site non installé peuvent être supprimées après 7 jours sans visite. L'application affiche, sur Safari et hors mode installé (`display-mode: standalone`), une invitation à l'**ajouter à l'écran d'accueil**.
- Sur iOS / iPadOS, l'application ajoutée à l'écran d'accueil a un stockage **séparé** de celui de Safari. Un lien (§6.5, §6.6) ouvert depuis une autre application s'ouvre dans Safari : le prompt est chargé dans le stockage de Safari, pas dans celui de l'application installée. L'utilisateur peut alors le copier (lien) ou passer par Google Drive.

---

## 6. Édition, sauvegarde et partage (F1, F2, F20–F29)

### 6.1 Session d'édition (`sessionStore`)

- Contient le brouillon courant (`Draft`) et la version enregistrée de référence (`Prompt | null`).
- **État « modifié »** = brouillon non vide sans `promptId`, ou brouillon différent (titre, texte, réglages) du prompt enregistré.
- Chaque modification du brouillon (texte ou réglage, y compris pendant la lecture) est écrite dans la table `draft` avec un **anti-rebond de 500 ms**, et immédiatement lors de l'événement `pagehide`/`visibilitychange` (masquage). Aucune écriture dans `prompts` sans action explicite (D3).
- Au démarrage : lecture de `draft` ; s'il est absent, brouillon vide avec les réglages par défaut des préférences.
- Si `baseUpdatedAt` ne correspond plus au `updatedAt` du prompt en base (modifié depuis un autre onglet), l'enregistrement demande confirmation avant d'écraser.

### 6.2 Actions

| Action | Effet technique |
|---|---|
| Nouveau | Confirmation si « modifié » ; brouillon vide, `promptId = null`, réglages par défaut. |
| Enregistrer | Si `promptId` nul : demande du titre, création (`id`, `createdAt`). Sinon mise à jour. Recalcule `stats`. Met à jour `baseUpdatedAt`. |
| Enregistrer sous / Dupliquer | Nouveau `id`, nouveau titre, mêmes texte et réglages. |
| Ouvrir | Confirmation si « modifié » ; copie du prompt dans le brouillon ; `lastUsedAt` mis à jour au lancement de la lecture. |
| Supprimer | Confirmation ; suppression ; si c'est le prompt courant, le brouillon devient non enregistré (`promptId = null`). |

Titre par défaut : les 6 premiers mots du texte (sans syntaxe Markdown), tronqués à 60 caractères.

### 6.3 Bibliothèque (F21)

- Liste via `useLiveQuery` (mise à jour automatique après chaque écriture).
- **Recherche** : filtrage en mémoire sur titre + texte, après normalisation (minuscules, suppression des accents via `normalize('NFD')`). Volume attendu : quelques centaines de prompts au plus, donc pas d'index plein texte.
- **Tri** : `updatedAt` (défaut), `lastUsedAt`, `title` (`localeCompare` en français), durée.
- **Statistiques** affichées : `stats` calculées à l'enregistrement. En mode px/s, la durée dépend de l'affichage ; `estimatedDurationSec` est alors la dernière durée mesurée par le prompteur (mise à jour dans le brouillon puis enregistrée), ou à défaut une estimation à partir de l'équivalent mots/min.

### 6.4 Import / export (F24)

Format d'échange JSON :

```json
{
  "format": "teleprompteur",
  "version": 1,
  "exportedAt": "2026-11-01T14:32:00.000Z",
  "prompts": [ { "id": "…", "title": "…", "text": "…", "settings": { … }, "createdAt": "…", "updatedAt": "…" } ]
}
```

- Nom de fichier : `<titre-slug>.teleprompteur.json` (un prompt) ou `teleprompteur-export_<AAAA-MM-JJ>.json` (bibliothèque).
- **Import** : validation zod du fichier entier avant toute écriture ; erreur explicite si invalide. Pour chaque prompt dont l'`id` existe déjà : choix « Remplacer » / « Garder les deux » (nouvel `id`, titre suffixé « (copie) »), avec option « Appliquer à tous ».
- **Import .txt / .md** : un prompt créé, titre = nom du fichier sans extension, réglages par défaut. Lecture via `File.text()` ; encodage UTF-8 attendu.
- **Export .md** : le texte source tel quel. **Export .txt** : texte sans syntaxe Markdown (cf. §8.3).
- `lastPosition` et `drive` ne sont pas exportés (propres à l'appareil).
- Les fichiers Google Drive (§6.6) utilisent ce même format, avec un seul prompt.

### 6.5 Lien de partage `#prompt=` (F28)

**Format**

```
https://www.sebastien-fauvart.fr/teleprompteur/#prompt=1.<charge utile>
```

- `1` : version du format d'encodage, pour pouvoir le faire évoluer sans casser les liens existants.
- Charge utile : `base64url( deflate( UTF-8( JSON(SharedPrompt) ) ) )`, sans caractère de remplissage `=`. Compression `fflate` (`deflateSync`, niveau 9).
- Les réglages sont transmis **en entier** (et non en différence avec les valeurs par défaut) : le lien reproduit le même affichage même si les valeurs par défaut évoluent.
- Ordre de grandeur : le lien fait environ 55 à 60 % de la longueur du texte (compression ≈ 40–45 % sur du français, puis + 33 % d'encodage base64). Un texte de 1 000 mots donne un lien d'environ 3 500 caractères.

**Limites**

| Seuil | Comportement |
|---|---|
| Lien > 8 000 caractères | Lien généré, avec avertissement (troncature possible par les messageries, clients mail, QR codes) et proposition de Google Drive ou de l'export. |
| Lien > 64 000 caractères | Lien non généré ; Google Drive ou l'export sont proposés. Valeur prudente, à ajuster après tests sur les navigateurs cibles. |
| Décodage : fragment > 128 000 caractères, ou contenu décompressé > 1 Mo | Rejet (protection contre les liens piégés). La décompression se fait en flux (`fflate.Inflate`) et s'interrompt dès que la limite est dépassée. |

**Génération** : URL = `new URL(import.meta.env.BASE_URL, location.origin)` + `#prompt=…`. Copie avec `navigator.clipboard.writeText` ; sur mobile, `navigator.share({ title, url })` si disponible.

**Chargement** (`boot/fragmentLoader.ts`, au démarrage et sur l'événement `hashchange` si l'application est déjà ouverte) :

1. Décodage : version, base64url, décompression bornée, `JSON.parse`, validation zod (`sharedPrompt`) avec normalisation des réglages (§5.2).
2. Retrait du fragment (`history.replaceState` vers `#/`).
3. En cas d'erreur à l'une des étapes : toast « Lien invalide ou corrompu », session inchangée.
4. En cas de succès : si le brouillon est « modifié », dialogue « Enregistrer d'abord / Remplacer / Annuler ». Le prompt devient alors le brouillon courant (`promptId = null`, `drive = null`) et l'éditeur s'affiche.

**Confidentialité** : le fragment n'est pas envoyé au serveur (GitHub Pages ne le reçoit pas), mais le texte est lisible par quiconque possède le lien et reste dans l'historique du navigateur.

### 6.6 Google Drive (F29)

**Configuration Google Cloud** (prérequis, cf. §17)

- Projet Google Cloud avec les API **Google Drive** et **Google Picker** activées.
- Écran de consentement OAuth : type « Externe », nom « Téléprompteur », domaine autorisé `sebastien-fauvart.fr`, liens vers la page d'accueil et vers une **politique de confidentialité** (page statique `confidentialite.html` livrée avec l'application), portée unique `https://www.googleapis.com/auth/drive.file`. Cette portée n'est pas classée « sensible » : l'application peut être publiée en production sans procédure de vérification de sécurité.
- Identifiant client OAuth de type « Application Web », origines JavaScript autorisées : `https://www.sebastien-fauvart.fr` et `http://localhost:5173` (développement).
- Clé d'API restreinte aux référents `https://www.sebastien-fauvart.fr/teleprompteur/*` et `http://localhost:5173/*`, et aux API Drive et Picker.
- Ces trois valeurs (identifiant client, clé d'API, numéro de projet pour le Picker) sont publiques par nature (présentes dans le code du navigateur). Elles sont injectées au build par `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY` et `VITE_GOOGLE_APP_ID`. Si elles sont absentes, les fonctions Drive sont masquées.

**Authentification** (`services/google/auth.ts`)

- Flux « jeton » de Google Identity Services : `google.accounts.oauth2.initTokenClient({ client_id, scope, callback })`, puis `requestAccessToken()` appelé **depuis un geste utilisateur** (sinon la fenêtre de connexion est bloquée).
- Le jeton d'accès (durée de vie ≈ 1 h) est conservé **en mémoire uniquement** : jamais dans IndexedDB ni `localStorage`, jamais journalisé. Pas de jeton de rafraîchissement (flux navigateur).
- À expiration ou sur réponse 401 : nouvelle demande `requestAccessToken({ prompt: '' })` au prochain geste utilisateur (sans nouvel écran de consentement si l'accès a déjà été accordé).
- Déconnexion (Préférences) : `google.accounts.oauth2.revoke(jeton)`, oubli du jeton.
- Scripts Google chargés à la demande (`scriptLoader.ts`) au premier usage d'une fonction Drive.

**Fichiers et appels REST** (`services/google/drive.ts`, `fetch` avec `Authorization: Bearer <jeton>`)

| Opération | Appel |
|---|---|
| Créer le dossier « Téléprompteur » (première sauvegarde ; recréé s'il a disparu) | `POST /drive/v3/files` avec `mimeType: application/vnd.google-apps.folder` ; id mémorisé dans `preferences.driveFolderId` |
| Créer un fichier prompt | `POST /upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime,capabilities/canEdit` |
| Mettre à jour (contenu + nom si le titre a changé) | `PATCH /upload/drive/v3/files/{id}?uploadType=multipart&fields=id,modifiedTime` |
| Lire les métadonnées | `GET /drive/v3/files/{id}?fields=id,name,modifiedTime,capabilities/canEdit` |
| Lire le contenu | `GET /drive/v3/files/{id}?alt=media` |
| Lister les prompts de l'utilisateur | `GET /drive/v3/files?q=appProperties has { key='app' and value='teleprompteur' } and trashed=false&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)` |
| Rendre public par lien | `POST /drive/v3/files/{id}/permissions` avec `{ role: 'reader', type: 'anyone' }`, après confirmation |

- Fichier : `<titre>.teleprompteur.json`, `mimeType: application/json`, `appProperties: { app: 'teleprompteur', format: '1' }`, contenu au format d'export (§6.4) avec un seul prompt : lisible et réimportable manuellement.
- **Ouvrir un fichier partagé par un tiers** : Google Picker (vue limitée aux fichiers `application/json`) ; la sélection accorde à l'application l'accès à ce fichier (fonctionnement de la portée `drive.file`).

**Enregistrer dans Drive**

1. Enregistrement local (§6.2).
2. Si `drive` est nul : création du fichier. Sinon, lecture de `modifiedTime` : s'il diffère de `drive.modifiedTime`, dialogue de conflit « Écraser la version Drive / Charger la version Drive / Annuler ».
3. Si `drive.canEdit` est faux (fichier d'un tiers en lecture seule) : proposition « Enregistrer une copie dans mon Drive » (création d'un nouveau fichier).
4. Mise à jour de `drive` (`modifiedTime`, `contentHash`).

L'indicateur « modifié depuis le dernier envoi » est vrai quand l'empreinte courante (titre + texte + réglages) diffère de `drive.contentHash`.

**Lien `#gdrive=FILE_ID`**

- Génération : `https://www.sebastien-fauvart.fr/teleprompteur/#gdrive=<fileId>`, copiée comme en §6.5.
- Chargement (`boot/fragmentLoader.ts`) ; l'identifiant doit respecter `^[A-Za-z0-9_-]{10,128}$` :
  1. Retrait du fragment (`history.replaceState`).
  2. Hors connexion : message « Connexion nécessaire pour ouvrir ce prompt Drive ».
  3. Essai **sans authentification** : `GET /drive/v3/files/{id}?alt=media&key=<clé d'API>` (fonctionne si le fichier est public par lien).
  4. Sinon : écran « Ce lien ouvre un prompt stocké dans Google Drive » avec le bouton « Se connecter à Google et ouvrir » (geste utilisateur requis), puis nouvel essai avec le jeton.
  5. Toujours introuvable avec le jeton (fichier non accessible à l'application pour cet utilisateur, limite de `drive.file`) : ouverture du Picker présélectionné sur ce fichier (`DocsView.setFileIds([id])`) ; la sélection accorde l'accès, puis nouvel essai.
  6. Contenu validé par le schéma d'export, puis chargement dans le brouillon selon les règles de §6.5 (confirmation si « modifié »), avec `drive` renseigné à partir des métadonnées.

---

## 7. Moteur de défilement (F3–F9, F31)

C'est le composant critique. Il est **impératif et indépendant de React** (`scrollEngine.ts`) : React ne re-rend pas à chaque image.

### 7.1 Géométrie

- `H` : hauteur de la surface du prompteur (fenêtre moins la barre de contrôles si elle est affichée).
- Ligne de départ `startY = 0,35 × H` (haut de la zone de lecture, qui s'étend de 0,32 × H à 0,70 × H).
- `p` : distance défilée en pixels (nombre réel, ≥ 0).
- Position appliquée au contenu : `transform: translate3d(0, startY − p, 0)` sur l'élément de texte, avec `will-change: transform`.
- `D` : hauteur totale du contenu = distance à parcourir. **Fin du texte** quand `p ≥ D` (la dernière ligne atteint le haut de la zone de lecture).
- `D` et `H` sont suivis par un `ResizeObserver` (contenu et surface) : changement de taille de police, de largeur, d'orientation, chargement de police.

### 7.2 Vitesse effective

`v` = vitesse effective en px/s :

- mode **px/s** : `v = valeur` ;
- mode **mots/min** : `v = D × wpm / (60 × W)` où `W` = nombre de mots (§8.3). Si `W = 0`, `v` vaut l'équivalent par défaut de 48 px/s.

`v` est recalculée à chaque changement de `D`, `W` ou de réglage de vitesse.

Conversions lors d'un changement d'unité (F5) : `pxps = D × wpm / (60 × W)` et inversement `wpm = 60 × W × pxps / D`, puis arrondi au pas et bornage (`domain/speed.ts`).

### 7.3 Boucle d'animation

- `requestAnimationFrame` ; à chaque image : `dt = min(maintenant − précédent, 100 ms)` (le plafond évite un saut après un onglet masqué), puis `p += v × dt / 1000`, et application du `transform`.
- Défilement en sous-pixels pour la fluidité ; aucune lecture de mise en page (`offsetHeight`…) dans la boucle.
- Les affichages de temps sont mis à jour seulement quand la seconde affichée change (via un abonnement du composant `Controls` au moteur).

### 7.4 États

Quatre états : `idle` (au début, à l'arrêt), `playing`, `paused`, `ended` (fin du texte atteinte).

| Transition | Effets |
|---|---|
| idle → playing | (P2 : compte à rebours) ; démarrage de la boucle ; wake lock ; audio démarré si activé. |
| playing → paused | Arrêt de la boucle ; audio en pause ; wake lock relâché ; `lastPosition` mémorisée. |
| paused → playing | Reprise depuis `p` ; audio repris ; wake lock. |
| playing → ended | Arrêt de la boucle ; **audio terminé** (fichier proposé) ; indicateur « Fin ». |
| ended → playing (Play) | `p = 0` puis lecture. |
| playing / paused / ended → idle (Stop) | `p = 0` ; temps écoulé à zéro ; audio terminé. |

### 7.5 Temps

- Durée estimée : `W × 60 / wpm` en mode mots/min, `D / v` en mode px/s (F8).
- Temps écoulé : `p / v` (cohérent avec la position réelle, y compris après un déplacement manuel).
- Formatage : `MM:SS` si < 1 h, sinon `HH:MM:SS`.

### 7.6 Ancrage lors d'un changement de mise en page (F6, appareils cibles)

Pour que la ligne en cours de lecture reste dans la zone de lecture quand `D` change :

1. avant la nouvelle mise en page, repérer le bloc (paragraphe) situé à la hauteur `p` du contenu, et la fraction `f` de ce bloc déjà défilée ;
2. après la mise en page (`useLayoutEffect` / `ResizeObserver`), recalculer `p = haut(bloc) + f × hauteur(bloc)`.

Chaque bloc porte un attribut `data-block` (indice). La même représentation (`blockIndex`, `fraction`) sert à mémoriser `lastPosition` (F25) ; à la reprise, la position n'est proposée que si `textHash` correspond au texte actuel.

### 7.7 Déplacements manuels et sauts

| Entrée | Effet sur `p` (toujours borné à `[0, D]`) |
|---|---|
| Molette (`wheel`) | `p += deltaY` (normalisé en pixels selon `deltaMode`) |
| Glisser au doigt / souris (`@use-gesture`) | `p -= déplacement vertical` |
| Page ↓ / Page ↑ | `p ± 0,8 × H`, animé sur 250 ms |
| → / ← | début du bloc suivant / précédent, animé (P2 : sections, F43) |
| Début | équivaut à Stop |
| Pincement | `fontSize = arrondi(taille_initiale × échelle)`, borné 1–20, avec ancrage §7.6 |
| Tap / clic sans déplacement | Play / Pause |

En lecture, un déplacement manuel ne met pas en pause : la lecture continue depuis la nouvelle position.

### 7.8 Miroir et inversion (F7)

`transform: scale(sx, sy)` sur le conteneur du texte (et non sur le contenu animé, pour ne pas mélanger avec la translation), avec `sx = mirrorX ? −1 : 1` et `sy = mirrorY ? −1 : 1`. La zone de lecture n'est pas retournée.

---

## 8. Texte et Markdown (F1, F43, F56)

### 8.1 Éditeur CodeMirror 6

Dès P1 :
- `EditorView` avec `EditorView.lineWrapping`, hauteur qui suit le contenu (hauteur minimale fixée), attributs `spellcheck="false"` et `autocapitalize="sentences"` sur la zone éditable, focus automatique à l'ouverture.
- Historique (`history()`) pour Ctrl+Z / Ctrl+Maj+Z.
- Raccourci **Ctrl/Cmd+Entrée** → lancer le prompteur ; **Ctrl/Cmd+S** → enregistrer (empêche le comportement par défaut du navigateur).
- Chaque modification met à jour le brouillon (§6.1).

En P3 (F56), ajouts :
- `@codemirror/lang-markdown` + une `HighlightStyle` : gras affiché en gras, italique en italique, titres plus grands, surlignage coloré, marqueurs de syntaxe atténués.
- Extension de parseur Lezer pour `==surlignage==` (délimiteur en ligne personnalisé).
- Barre d'outils : commandes qui encadrent la sélection (`**`, `*`, `==`) ou préfixent la ligne (`#`, `##`, `-`, `1.`), insertion de `---` ; raccourcis Ctrl+B, Ctrl+I, Ctrl+Maj+H.
- Boutons de taille tactile (≥ 44 px), barre fixée au-dessus du clavier virtuel sur mobile.

### 8.2 Rendu dans le prompteur

- **P1** : le texte est découpé en blocs sur les lignes vides ; chaque bloc est rendu en `<p data-block>` avec `white-space: pre-wrap`. Les lignes vides supplémentaires sont rendues comme des espacements. Aucune interprétation de syntaxe.
- **P3** : `markdown-it` configuré avec `html: false`, `linkify: false`, `typographer: false`, `breaks: true` ; seules les règles nécessaires sont activées (paragraphe, titre, séparateur, listes, emphase, `markdown-it-mark`). Les liens, images, tableaux, code, citations et HTML sont désactivés : leur syntaxe reste affichée en texte. Les jetons produits sont convertis en **éléments React** (jamais de `dangerouslySetInnerHTML`). Les lignes vides multiples sont préservées par un pré-traitement qui insère des blocs d'espacement.
- **P2** (F43) : règle en ligne personnalisée pour les indications scéniques `[…]`, rendues en `<span class="stage">` dans une couleur distincte ; titres et séparateurs marqués `data-section` pour les sauts ← / →.

### 8.3 Texte brut et décompte des mots

- `domain/markdown` fournit `toPlainText(source)` : texte sans syntaxe (utilisé pour l'export .txt, le titre par défaut, la recherche).
- `domain/words.ts` : `countWords(source)` = nombre de segments `isWordLike` d'`Intl.Segmenter('fr', { granularity: 'word' })` sur le texte brut, **en excluant les indications scéniques**.
- Ces fonctions sont mémoïsées par texte source (recalcul seulement quand le texte change).

---

## 9. Services navigateur

### 9.1 Enregistrement audio (F10)

- **Activation de l'interrupteur** (ou ouverture du prompteur avec `recordAudio = true`) : `getUserMedia({ audio: true })`. En cas d'échec (refus, absence de micro, contexte non sécurisé) : interrupteur désactivé, message adapté au type d'erreur (`NotAllowedError`, `NotFoundError`…).
- Le flux est conservé pendant que le prompteur est ouvert et l'interrupteur actif ; ses pistes sont arrêtées (`track.stop()`) à la fermeture ou à la désactivation, ce qui éteint le témoin micro du système.
- **Format** : premier type supporté (`MediaRecorder.isTypeSupported`) parmi `audio/webm;codecs=opus`, `audio/mp4`, `audio/ogg;codecs=opus`, `audio/webm`. Extension associée : `.webm`, `.m4a`, `.ogg`.
- Correspondance avec le moteur : `playing` → `start()` ou `resume()` ; `paused` → `pause()` ; `ended` / Stop / Fermer / désactivation → `stop()`.
- À l'événement `stop` : assemblage des morceaux en `Blob`, puis remise du fichier (§9.3).
- Nom : `<titre-slug>_<AAAA-MM-JJ>_<HH-mm>.<ext>` ; titre absent → `Prompt`.
- Indicateur d'enregistrement piloté par l'état réel du `MediaRecorder` (`recording`).

### 9.2 Wake lock et plein écran

- **Wake lock** : `navigator.wakeLock.request('screen')` à l'entrée en `playing`, relâché en `paused` / `idle` / `ended` / fermeture ; redemandé sur `visibilitychange` si la lecture est en cours.
- **Plein écran** : `requestFullscreen()` sur l'élément racine du prompteur (repli `webkitRequestFullscreen` pour iPadOS) ; sortie à la fermeture du prompteur ; l'état du bouton suit l'événement `fullscreenchange` (sortie par Échap incluse).

### 9.3 Remise de fichiers (`fileSaver.ts`)

- Ordinateur : lien temporaire `<a download>` sur une URL `blob:`, révoquée après le clic.
- Mobile : si `navigator.canShare({ files })` est vrai, partage natif (`navigator.share`) permettant d'enregistrer dans Fichiers, de l'envoyer, etc. ; sinon repli sur le lien de téléchargement.

---

## 10. Pilotage (F30–F33)

- **Raccourcis** : un écouteur `keydown` unique sur `window` dans le prompteur (`useShortcuts`), fondé sur `event.key`. Ignoré quand le focus est dans un champ de saisie (sauf Échap). `preventDefault()` sur Espace et les flèches pour empêcher le défilement de la page. Table des raccourcis centralisée, réutilisée par l'aide (`?`).
- **Télécommandes / pédales** : elles émettent des touches standard (Page ↑/↓, flèches, Espace, Entrée) : aucun traitement spécifique.
- **Masquage de la barre** (F33) : bascule par H ; masquage automatique après 3 s de lecture sans mouvement de pointeur, réaffichage au moindre mouvement ou tap. Quand la barre est masquée, `H` (§7.1) est recalculé et l'ancrage §7.6 s'applique.
- **Petit écran** : sous 640 px de large, la barre n'affiche que Play/Pause, Stop, vitesse, taille et Fermer ; les autres commandes passent dans un menu.

---

## 11. PWA

- `vite-plugin-pwa` en mode `generateSW` : **précache de tous les fichiers de build** (HTML, JS, CSS, polices, icônes) → fonctionnement hors ligne dès la première visite.
- Mise à jour en mode `prompt` : quand une nouvelle version est disponible, un message « Nouvelle version disponible — Recharger » s'affiche ; jamais de rechargement forcé pendant une lecture.
- Manifeste : `name` « Téléprompteur », `display: standalone`, `orientation: any`, `theme_color` et `background_color` `#0d0d0d`, icônes 192 px, 512 px et *maskable*, `lang: fr`.
- Publication dans le sous-chemin `/teleprompteur/` : `base: '/teleprompteur/'` dans Vite ; manifeste avec `start_url: './'` et `scope: './'` ; service worker de portée `/teleprompteur/`.
- Enregistrement du service worker avec `updateViaCache: 'none'`, pour que la recherche de mise à jour ignore le cache HTTP imposé par GitHub Pages.
- Les appels à Google (§6.6) ne passent pas par le cache du service worker (seuls les fichiers de build sont précachés).

---

## 12. Sécurité et confidentialité

- **Content-Security-Policy** en balise `<meta>` (GitHub Pages ne permet pas d'en-têtes HTTP personnalisés), injectée au build de production uniquement :

  ```
  default-src 'self';
  script-src 'self' https://accounts.google.com https://apis.google.com;
  style-src 'self' https://accounts.google.com;
  connect-src 'self' https://www.googleapis.com https://accounts.google.com;
  frame-src https://accounts.google.com https://docs.google.com;
  img-src 'self' data: blob: https://*.googleusercontent.com https://ssl.gstatic.com;
  media-src 'self' blob:;
  object-src 'none'; base-uri 'self'; form-action 'none'
  ```

  Les sources Google sont à affiner lors de l'intégration du Picker (vérification des violations dans la console). Limite d'une CSP en `<meta>` : `frame-ancestors` et `report-uri` n'y sont pas pris en compte.
- Aucun script, police, image ou service tiers en dehors de Google, chargé uniquement à l'usage des fonctions Drive ; polices auto-hébergées.
- Jeton OAuth en mémoire uniquement (§6.6) ; portée minimale `drive.file`.
- Contenus reçus par lien ou depuis Drive : décompression bornée et validation zod complète avant tout usage (§6.5, §6.6).
- Aucun HTML utilisateur interprété (§8.2) ; aucune utilisation de `innerHTML` / `dangerouslySetInnerHTML`.
- Fichiers importés validés intégralement (zod) avant écriture ; taille maximale d'import : 10 Mo.
- Aucune donnée ne quitte l'appareil, sauf action explicite de l'utilisateur (export, lien de partage, Google Drive).

---

## 13. Performance et accessibilité

**Performance**
- 60 images/s en défilement sur une tablette milieu de gamme avec un texte de 5 000 mots et une police à 160 px.
- Aucun re-rendu React pendant le défilement (§7.3) ; contenu du prompteur mémoïsé par (texte, réglages d'affichage).
- Démarrage hors ligne < 1 s sur ordinateur ; bundle initial < 300 Ko gzip. CodeMirror et markdown-it chargés en différé (`import()` dynamique) s'ils dépassent ce budget.

**Accessibilité**
- Tous les boutons ont un nom accessible (`aria-label`) et une info-bulle ; interrupteurs en `role="switch"`.
- Navigation complète au clavier dans l'éditeur, la bibliothèque et les préférences ; focus visible ; focus piégé dans les modales (`<dialog>` natif).
- Contraste AA pour l'interface ; cibles tactiles ≥ 44 × 44 px.
- Textes de l'interface centralisés dans `i18n/fr.ts`.

---

## 14. Qualité et tests

| Niveau | Outil | Périmètre |
|---|---|---|
| Typage | `tsc --noEmit` (strict) | Tout le code. |
| Lint / format | ESLint + typescript-eslint, Prettier | Tout le code. |
| Unitaire | Vitest | `domain/` (conversions de vitesse, durées, bornage, décompte des mots avec indications scéniques, sous-ensemble Markdown, noms de fichiers, recherche) : couverture ≥ 90 %. Moteur de défilement avec horloge et `requestAnimationFrame` simulés. |
| Stockage | Vitest + `fake-indexeddb` | Dépôts, migrations, brouillon, import/export (fichiers valides, invalides, conflits d'identifiants). |
| Liens et Drive | Vitest | `shareLink` : aller-retour encodage/décodage (accents, emojis, textes longs), seuils de taille, fragments corrompus, version inconnue, contenu décompressé trop volumineux. `fragmentLoader` : confirmation si brouillon modifié, nettoyage de l'URL. `drive.ts` avec `fetch` simulé : création, mise à jour, conflit, 401 puis nouveau jeton, 403 lecture seule, 404. |
| Composants | Vitest + Testing Library (jsdom) | Éditeur, barre de contrôles, bibliothèque, dialogues de confirmation. |
| Bout en bout | Playwright | Parcours P1 à P5 de la spec fonctionnelle, sur Chromium, Firefox et WebKit, plus émulation iPad et smartphone Android. Audio testé sous Chromium avec `--use-fake-device-for-media-stream` et `--use-fake-ui-for-media-stream`. Vérification du fonctionnement hors ligne (contexte Playwright `offline`). Ouverture d'un lien `#prompt=`. Parcours Drive avec scripts Google remplacés par des simulations et appels `googleapis.com` interceptés (`page.route`) : aucun compte Google réel en CI. |

Scripts npm : `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`.

---

## 15. Build, intégration continue et déploiement

**Dépôt** : https://github.com/sfauvart/teleprompteur — branche de développement `main`, branche de publication `gh-pages` (générée, jamais modifiée à la main).

**Build** : `npm run build` produit un dossier `dist/` entièrement statique, avec `base: '/teleprompteur/'`, plus un fichier `.nojekyll` (désactive le traitement Jekyll de GitHub Pages) et la page `confidentialite.html` (§6.6).

**GitHub Actions**

| Workflow | Déclencheur | Étapes |
|---|---|---|
| `ci.yml` | Pull request, push sur une branche autre que `main` | `npm ci` → `lint` → `typecheck` → `test` → `build` → `test:e2e` sur le build (`vite preview`) |
| `deploy.yml` | Push sur `main` | Mêmes étapes, puis publication du contenu de `dist/` sur la branche `gh-pages` (action `peaceiris/actions-gh-pages`, version à figer). Concurrence limitée à un déploiement à la fois. |

- `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY` et `VITE_GOOGLE_APP_ID` sont des **variables** de dépôt GitHub (non secrètes : elles se retrouvent dans le code publié), passées à l'étape `build`.
- Le workflow `deploy.yml` a besoin de la permission `contents: write`.

**GitHub Pages**

- Réglages du dépôt → Pages → Source : « Deploy from a branch », branche `gh-pages`, dossier `/ (root)`.
- Domaine : le site utilisateur `sfauvart.github.io` étant associé au domaine personnalisé `www.sebastien-fauvart.fr`, le site du dépôt est servi automatiquement sous **https://www.sebastien-fauvart.fr/teleprompteur/**. Aucun fichier `CNAME` n'est nécessaire dans ce dépôt.
- HTTPS fourni et imposé par GitHub Pages.
- GitHub Pages ne permet ni en-têtes personnalisés ni règles de cache : CSP en `<meta>` (§12), noms de fichiers versionnés par Vite (`assets/*-<hash>.js`) pour l'invalidation, service worker avec `updateViaCache: 'none'` (§11).
- Le routage par fragment (§4.3) évite tout besoin de redirection 404 côté serveur.

---

## 16. Correspondance fonctionnalités → modules

| Fonctionnalités | Modules principaux |
|---|---|
| F1, F2 | `features/editor`, `stores/sessionStore`, `domain/words` |
| F3–F9, F11 | `features/prompter`, `features/prompter/engine`, `domain/speed`, `domain/duration` |
| F10 | `services/audioRecorder`, `services/fileSaver`, `domain/filename` |
| F20–F23, F25, F27 | `storage/*`, `stores/sessionStore`, `features/library`, `features/preferences` |
| F24 | `storage/exchange`, `services/fileSaver` |
| F26 | §1, §12 |
| F28 | `domain/shareLink`, `boot/fragmentLoader`, `services/clipboard` |
| F29 | `services/google/*`, `boot/fragmentLoader`, `features/library` |
| F30–F33 | `features/prompter/useShortcuts`, `useGestures`, `Controls` |
| F40–F44 (P2) | `domain/settings` (déjà prévu), `features/prompter`, `domain/markdown` |
| F56 (P3) | `features/editor` (CodeMirror Markdown), `domain/markdown` |
| Appareils cibles | §2, §7.6, §9.2, §10 |

---

## 17. Prérequis à la charge du propriétaire

| # | Action | Nécessaire pour |
|---|---|---|
| 1 | Activer GitHub Pages sur le dépôt (branche `gh-pages`, après le premier déploiement) | Mise en ligne |
| 2 | Vérifier que `https://www.sebastien-fauvart.fr/teleprompteur/` répond après le premier déploiement | Mise en ligne |
| 3 | Créer le projet Google Cloud, l'écran de consentement, l'identifiant client OAuth et la clé d'API (§6.6) | F29 |
| 4 | Renseigner les variables de dépôt `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, `VITE_GOOGLE_APP_ID` | F29 |
| 5 | Relire le contenu de la page `confidentialite.html` | F29 (exigée par Google) |
