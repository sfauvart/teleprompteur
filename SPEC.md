# Téléprompteur local — Spécification fonctionnelle

> Version 0.1 — 2026-11-01
> Périmètre de ce document : **fonctionnel uniquement**. Les choix techniques (stack, stockage, packaging) feront l'objet d'un document séparé.

---

## 1. Contexte et objectifs

L'application est un **téléprompteur utilisable en local** : l'utilisateur saisit ou colle un texte, clique sur **« Prompt ! »**, et le texte défile à l'écran à vitesse réglable pour être lu face caméra, en répétition ou en direct.

Objectifs :

1. Offrir un téléprompteur simple, sans publicité, sans traceur, fonctionnant sans connexion.
2. Permettre de **sauvegarder ses prompts** (texte + paramètres) pour les réutiliser.
3. Faciliter le pilotage pendant la lecture (clavier, télécommande, pédale) et le confort de lecture.

Vocabulaire utilisé dans ce document :

| Terme | Définition |
|---|---|
| **Prompt** | Ensemble formé d'un texte à lire et de ses paramètres d'affichage/défilement. C'est l'objet qu'on sauvegarde. |
| **Éditeur** | Écran de saisie du texte. |
| **Prompteur** | Écran plein cadre sur fond noir où le texte défile. |
| **Zone de lecture** | Bande horizontale en surbrillance, matérialisant l'endroit où l'œil doit lire. |
| **Session de lecture** | Période entre le premier Play et le Stop (ou la fin du texte). |

Priorités utilisées : **P1** = première version (MVP), **P2** = version suivante, **P3** = plus tard / idée à valider.

### Appareils cibles

L'application doit être pleinement utilisable sur **ordinateur**, **tablette** et **smartphone**, dès la première version :

- **Mise en page adaptative** : éditeur, prompteur, bibliothèque et préférences s'adaptent à la largeur de l'écran, en portrait comme en paysage.
- **Barre de contrôles du prompteur sur petit écran** : les commandes essentielles (Play/Pause, Stop, vitesse, taille, Fermer) restent directement accessibles ; les autres (miroir, inversion, audio, plein écran, aide) sont regroupées dans un menu.
- **Commandes tactiles** : boutons de taille suffisante pour être utilisés au doigt ; gestes décrits en F31.
- **Clavier physique facultatif** : toutes les fonctions accessibles par raccourci clavier (F30) le sont aussi par l'interface tactile. Une tablette ou un smartphone avec clavier, télécommande ou pédale Bluetooth bénéficie des mêmes raccourcis qu'un ordinateur.
- **Changement d'orientation ou de taille de fenêtre** pendant la lecture : la ligne en cours de lecture reste dans la zone de lecture et la durée estimée est recalculée.
- **Mise en veille** : l'écran ne doit pas se mettre en veille pendant une lecture en cours.
- **Plein écran** : disponible lorsque l'appareil le permet ; à défaut, le bouton est masqué.

---

## 2. Éditeur et lancement — P1

### F1 — Éditeur de texte
- Zone de saisie large, fond sombre, texte clair, placeholder « Rédigez ou collez le texte à prompter... ».
- La zone s'agrandit automatiquement avec le contenu ; focus automatique à l'ouverture de l'application ; correcteur orthographique désactivé.
- Saisie, collage, coupe, annulation (Ctrl+Z) standards.
- Retours à la ligne, lignes vides et espaces sont conservés tels quels à l'affichage ; aucune balise HTML n'est interprétée.
- Le texte est conservé au **format Markdown** dès la première version, afin que la mise en forme légère (F56) s'ajoute sans conversion des prompts existants. Tant que F56 n'est pas livrée, le texte est affiché tel que saisi.
- Affichage permanent : **nombre de mots** et **durée estimée** avec les paramètres courants.

### F2 — Lancement du prompteur
- Bouton **« Prompt ! »** (et raccourci Ctrl+Entrée, cf. F30).
- Si le texte est vide ou ne contient que des blancs : message d'erreur en français affiché dans l'interface (pas de popup système) ; rien d'autre ne se passe.
- Sinon, ouverture du prompteur :
  - un calque noir couvre toute la fenêtre ;
  - la barre de contrôles est affichée en haut ;
  - la zone de lecture est affichée ;
  - le texte est positionné au début, sa première ligne **dans la zone de lecture** ;
  - le défilement de l'éditeur en arrière-plan est bloqué ;
  - le défilement du texte **ne démarre pas** : il faut lancer la lecture (Play).

---

## 3. Prompteur — P1

### F3 — Affichage
- Fond noir, texte blanc, colonne de texte centrée de largeur limitée, avec marges latérales.
- Texte non sélectionnable.
- **Zone de lecture** : bande blanche translucide (≈ 8 % d'opacité) occupant environ 32 % à 70 % de la hauteur d'écran, avec deux **triangles repères** blancs semi-transparents sur les bords gauche et droit, centrés verticalement dans la bande.
- À l'ouverture, la première ligne du texte se trouve à ≈ 35 % de la hauteur, soit en haut de la zone de lecture.

### F4 — Barre de contrôles
De gauche à droite :

| Contrôle | Comportement |
|---|---|
| **Play / Pause** (bouton bascule) | Play démarre ou reprend le défilement depuis la position courante. Pause fige le texte, le chronomètre et l'enregistrement audio. |
| **Plein écran** | Bascule en plein écran / en sort. |
| **Vitesse** | Cf. F5. |
| **Taille** | Cf. F6. |
| **Stop** | Arrête le défilement, **remet le texte au début**, remet le chronomètre à zéro, termine l'enregistrement audio. |
| **Enregistrement audio** (interrupteur) | Cf. F9. Un point rouge clignotant signale l'enregistrement en cours. |
| **Miroir** (interrupteur) | Cf. F7. |
| **Inverser** (interrupteur) | Cf. F7. |
| **Temps écoulé / Durée estimée** | Cf. F8. |
| **Fermer (✕)** | Cf. F11. |

### F5 — Vitesse
La vitesse s'exprime au choix dans l'une de deux **unités** ; l'unité fait partie des paramètres du prompt.

| Unité | Plage | Pas | Défaut | Principe |
|---|---|---|---|---|
| **Mots/minute** (unité par défaut) | 60 – 250 mots/min | 5 | 140 mots/min | Le texte défile pour que le nombre de mots passant dans la zone de lecture corresponde au débit choisi, **quelle que soit la taille du texte**. |
| **Pixels/seconde** | 4 – 200 px/s | 4 | 48 px/s | Le texte monte d'un nombre fixe de pixels par seconde. À valeur égale, un texte plus gros fait défiler moins de mots par minute. |

Règles :
- **Mode mots/minute** : la vitesse de défilement est **constante** (pas d'accélération selon la longueur des lignes) ; elle est calculée pour que le texte complet soit parcouru en `nombre de mots ÷ mots par minute`. Elle est recalculée quand la taille du texte, la mise en forme ou la largeur d'affichage changent, afin de maintenir le débit choisi.
- **Décompte des mots** : seuls les mots à prononcer comptent ; les indications scéniques (F43) et la syntaxe de mise en forme (F56) sont exclues.
- **Changement d'unité** : la valeur est convertie en son équivalent dans la nouvelle unité pour le texte et l'affichage courants (le défilement ne change pas de rythme), puis arrondie au pas et ramenée dans la plage.
- L'équivalent dans l'autre unité est affiché à titre indicatif à côté du réglage.
- L'unité par défaut des nouveaux prompts se règle dans les Préférences (F27).
- Le défilement doit être **fluide** (pas d'à-coups visibles).
- Ajustable pendant la lecture, effet immédiat depuis la position courante, sans saut.
- Saisie bornée : toute valeur hors plage est ramenée à la borne la plus proche ; champ vide → valeur précédente.

### F6 — Taille du texte
- Réglage de **1 à 20**, défaut **10** ; taille de police = `réglage × 8 px` (de 8 à 160 px, défaut 80 px).
- Ajustable à tout moment, y compris pendant la lecture, **en conservant la ligne en cours de lecture dans la zone de lecture**.
- En mode pixels/seconde, la durée estimée est recalculée à chaque changement ; en mode mots/minute, la durée ne change pas (c'est la vitesse en pixels qui s'adapte, cf. F5).
- Sur écran tactile, le pincement à deux doigts sur le texte modifie aussi la taille.
- Saisie bornée comme F5.

### F7 — Miroir et Inversion
Destinés à l'usage avec un téléprompteur physique (lecture à travers une vitre semi-réfléchissante).
- **Miroir** : retourne le texte horizontalement.
- **Inverser** : retourne le texte verticalement.
- Les deux combinés : rotation à 180°.
- L'état des interrupteurs reflète toujours l'affichage ; ces réglages font partie des paramètres sauvegardés du prompt (cf. F20).

### F8 — Temps
- Affichage `temps écoulé / durée estimée` au format `HH:MM:SS` (ou `MM:SS` si < 1 h).
- **Durée estimée** :
  - en mode mots/minute : `nombre de mots ÷ mots par minute` ; elle ne dépend que du texte et de la vitesse ;
  - en mode pixels/seconde : `hauteur totale du texte affiché (px) ÷ vitesse (px/s)` ; elle dépend aussi de la taille de police et de la largeur d'affichage (retours à la ligne automatiques).

  Elle est recalculée à chaque changement de l'un de ces éléments.
- **Temps écoulé** : suit la progression réelle du texte ; il se fige en pause et repart de la position courante à la reprise.

### F9 — Lecture : Play / Pause / Stop / fin du texte
- **Play** : démarre ou reprend le défilement depuis la position courante.
- **Pause** : fige le texte, le chronomètre et l'enregistrement audio.
- **Stop** : arrête, revient au début, remet le chronomètre à zéro, termine l'enregistrement.
- **Fin du texte** : quand la dernière ligne atteint le haut de la zone de lecture, le défilement **et l'enregistrement audio** s'arrêtent ; un indicateur « Fin » est affiché ; Play relance depuis le début.

### F10 — Enregistrement audio
- Interrupteur d'activation ; demande d'autorisation micro à l'activation ; message clair en cas de refus ou de micro absent (l'interrupteur repasse alors à l'état désactivé).
- Démarre avec Play, se met en pause avec Pause, reprend avec Play.
- Se termine avec Stop, Fermer, la fin du texte ou la désactivation de l'interrupteur.
- Indicateur rouge clignotant pendant l'enregistrement.
- À la fin : fichier audio proposé au téléchargement, nommé d'après le titre du prompt et l'horodatage (ex. `Discours-mariage_2026-11-01_14-32.webm`).
- Aucune donnée envoyée hors de l'appareil.

### F11 — Plein écran et fermeture
- Bouton plein écran en bascule ; Échap quitte le plein écran.
- Bouton ✕ (et Échap hors plein écran) : arrête la lecture et l'enregistrement, quitte le plein écran, revient à l'éditeur et réactive son défilement.
- Le texte et les paramètres modifiés dans le prompteur sont **conservés** dans l'éditeur.

---

## 4. Sauvegarde des prompts — P1

### F20 — Contenu d'un prompt sauvegardé

| Donnée | Description |
|---|---|
| Titre | Saisi par l'utilisateur. Par défaut : les premiers mots du texte. Obligatoire, non nécessairement unique. |
| Texte | Le texte intégral. |
| Paramètres | Vitesse, taille, miroir, inversion, et tous les paramètres d'affichage du §6 (couleurs, marges, interligne, compte à rebours…). |
| Enregistrement audio activé | Oui/non (l'autorisation micro peut être redemandée selon l'environnement). |
| Dernière position de lecture | Position où la lecture s'est arrêtée (pause ou fermeture), pour reprise (cf. F25). |
| Dates | Création, dernière modification, dernière utilisation. |
| Statistiques dérivées | Nombre de mots, durée estimée (calculés, affichés dans la liste). |

### F21 — Bibliothèque de prompts
- Un panneau (ou écran) **« Mes prompts »** liste les prompts sauvegardés : titre, extrait des premières lignes, nombre de mots, durée estimée, date de dernière modification.
- Tri : dernière modification (défaut), dernière utilisation, titre, durée.
- **Recherche** plein texte sur le titre et le contenu.
- Actions par prompt : **Ouvrir**, **Lancer directement** (ouvre le prompteur avec ses paramètres), **Renommer**, **Dupliquer**, **Supprimer** (avec confirmation), **Exporter**.
- État vide : message d'invitation à créer un premier prompt.

### F22 — Créer / enregistrer
- **Nouveau** : éditeur vide avec les paramètres par défaut (cf. F27).
- **Enregistrer** (Ctrl+S) : premier enregistrement → demande du titre ; ensuite → met à jour le prompt courant.
- **Enregistrer sous / Dupliquer** : crée une copie avec un nouveau titre (utile pour décliner un texte en plusieurs versions).
- Le titre du prompt courant est affiché dans l'éditeur, avec un indicateur « modifié » s'il y a des changements non enregistrés.
- Les paramètres changés pendant une lecture sont des modifications du prompt : ils activent l'indicateur « modifié » (l'utilisateur peut ainsi ajuster sa vitesse en répétition puis l'enregistrer).

### F23 — Protection contre la perte
- Un prompt n'est enregistré dans la bibliothèque **que sur action explicite** de l'utilisateur (Enregistrer / Enregistrer sous) ; il n'y a pas d'enregistrement automatique.
- En revanche, le **brouillon en cours** (prompt non encore enregistré ou modifications non enregistrées) est conservé pour éviter une perte accidentelle : fermer puis rouvrir l'application restaure l'éditeur dans l'état où on l'a laissé, avec l'indicateur « modifié ». Ce brouillon ne modifie pas la version enregistrée du prompt.
- Avant toute action qui ferait perdre des modifications (ouvrir un autre prompt, nouveau, suppression) : demande de confirmation « Enregistrer / Ne pas enregistrer / Annuler ».

### F24 — Import / export
- **Exporter** un prompt ou toute la bibliothèque dans un fichier (texte + paramètres) pour sauvegarde ou transfert vers un autre appareil.
- **Importer** ce même fichier ; en cas de prompt déjà présent : proposer remplacer / garder les deux.
- **Importer un fichier texte** (.txt ou .md) : crée un prompt avec les paramètres par défaut, titre = nom du fichier ; la mise en forme d'un fichier .md est reprise.
- Exporter le texte seul en .md (avec mise en forme) ou en .txt (sans mise en forme).

### F25 — Reprise de lecture
- À la réouverture d'un prompt dont la lecture avait été interrompue, proposer : « Reprendre là où vous vous étiez arrêté » ou « Recommencer au début ».

### F26 — Confidentialité
- Par défaut, toutes les données (prompts, préférences, enregistrements) restent **sur l'appareil de l'utilisateur**. L'application n'a pas de compte utilisateur propre.
- Les données ne quittent l'appareil que sur **action explicite** : export de fichier (F24), création d'un lien de partage (F28), enregistrement dans Google Drive (F29).
- L'application fonctionne sans connexion internet (seules les fonctions Google Drive la nécessitent).

### F27 — Paramètres par défaut
- Un écran **Préférences** permet de définir les paramètres appliqués à tout nouveau prompt (unité de vitesse — mots/minute par défaut —, vitesse, taille, couleurs, etc.).
- Action **« Définir comme paramètres par défaut »** depuis un prompt existant.
- Action **« Réinitialiser les paramètres »** d'un prompt aux valeurs par défaut.

### F28 — Lien de partage contenant le prompt — P1
- Action **« Copier le lien »** (éditeur et bibliothèque) : génère une adresse de l'application qui **contient le prompt lui-même** (titre, texte et paramètres, sous forme compressée), et la copie dans le presse-papiers (ou ouvre le partage natif sur mobile).
- Ouvrir ce lien charge le prompt dans l'éditeur, avec ses paramètres, comme un prompt **non enregistré** ; l'utilisateur l'enregistre dans sa bibliothèque s'il le souhaite.
- Si l'éditeur contient des modifications non enregistrées, une confirmation est demandée avant de les remplacer.
- Une fois le prompt chargé, l'adresse affichée est nettoyée (le rechargement de la page ne recharge pas le lien).
- Lien trop long (texte volumineux) : avertissement indiquant que certaines messageries peuvent le tronquer, et proposition d'utiliser Google Drive (F29) ou l'export (F24). Au-delà d'une taille maximale, le lien n'est pas généré.
- Lien invalide ou corrompu : message d'erreur, l'éditeur reste inchangé.
- Le contenu du lien n'est pas transmis au serveur qui héberge l'application ; en revanche, toute personne disposant du lien peut lire le texte.

### F29 — Google Drive — P2
- **Connexion** : bouton « Se connecter à Google Drive » ; l'application n'accède qu'aux fichiers qu'elle a créés ou que l'utilisateur lui a explicitement ouverts. Déconnexion possible à tout moment depuis les Préférences.
- **Enregistrer dans Drive** : action explicite (pas d'envoi automatique) depuis l'éditeur ou la bibliothèque. Le prompt (titre, texte, paramètres) est enregistré dans un fichier d'un dossier « Téléprompteur » du Drive de l'utilisateur ; les envois suivants mettent à jour le même fichier. Le prompt est aussi enregistré dans la bibliothèque locale.
- **Ouvrir depuis Drive** : liste des prompts enregistrés par l'application dans le Drive de l'utilisateur, et sélecteur de fichiers Google pour ouvrir un fichier partagé par quelqu'un d'autre.
- **Lien Drive** : action « Copier le lien Drive » qui produit une adresse de l'application désignant le fichier Drive. Ouvrir cette adresse charge le prompt depuis Drive (après connexion à Google si le fichier n'est pas public), selon les mêmes règles que F28. Option « Rendre accessible à toute personne disposant du lien », avec confirmation.
- **Indicateurs** : dans la bibliothèque, un pictogramme signale les prompts liés à un fichier Drive, et l'état « modifié depuis le dernier envoi sur Drive ».
- **Conflit** : si le fichier Drive a été modifié ailleurs depuis le dernier envoi, l'utilisateur choisit entre écraser la version Drive, charger la version Drive ou annuler.
- Hors connexion, les actions Drive sont désactivées avec une explication.

---

## 5. Pilotage pendant la lecture — P1

### F30 — Raccourcis clavier

| Touche | Action |
|---|---|
| Ctrl+Entrée (dans l'éditeur) | Lancer le prompteur |
| Espace | Play / Pause |
| Échap | Quitter le plein écran, sinon fermer le prompteur |
| ↑ / ↓ | Augmenter / diminuer la vitesse d'un pas (5 mots/min ou 4 px/s) |
| + / − | Augmenter / diminuer la taille du texte |
| Page ↑ / Page ↓ | Reculer / avancer d'un écran |
| ← / → | Reculer / avancer d'un paragraphe |
| Début | Revenir au début (équivaut à Stop) |
| F | Plein écran |
| M / I | Miroir / Inversion |
| H | Masquer / afficher la barre de contrôles |
| Ctrl+S | Enregistrer le prompt |

Les raccourcis sont listés dans une aide accessible depuis la barre de contrôles (touche `?`).

### F31 — Défilement manuel
- Molette de souris, glisser au doigt ou au pavé tactile : déplace le texte, en pause comme en lecture (la lecture reprend depuis la nouvelle position).
- Clic/tap sur le texte (hors barre) : Play/Pause.
- Pincement à deux doigts : taille du texte (cf. F6).

### F32 — Compatibilité télécommandes / pédales
- Les télécommandes de présentation et pédales Bluetooth émettent généralement Page ↑/↓, flèches ou Espace : ces touches doivent suffire à piloter la lecture (cf. F30).

### F33 — Barre de contrôles masquable
- La barre peut être masquée (raccourci H, ou masquage automatique après quelques secondes de lecture sans mouvement de souris) pour ne garder que le texte à l'écran.

---

## 6. Confort de lecture — P2

### F40 — Compte à rebours
- Option : compte à rebours de N secondes (0 à 10, défaut 3) affiché en grand avant le démarrage du défilement, pour avoir le temps de se mettre en place.

### F41 — Mise en forme de l'affichage
Paramètres supplémentaires (sauvegardés avec le prompt, cf. F20) :
- **Couleur du texte** et **couleur de fond** (avec quelques thèmes prédéfinis : blanc/noir, jaune/noir, noir/blanc).
- **Interligne**.
- **Largeur de la colonne de texte** / marges latérales.
- **Alignement** : gauche, centré.
- **Position de la zone de lecture** (haut, centre, ou réglage libre) et opacité de la surbrillance.
- **Police** parmi une courte liste lisible.

### F42 — Barre de progression
- Fine barre indiquant la progression dans le texte, cliquable pour se déplacer.

### F43 — Repères dans le texte
- Une syntaxe simple dans l'éditeur permet de distinguer les **indications scéniques** (ex. texte entre crochets `[pause]`, `[regarder caméra]`) affichées dans une couleur différente, pour qu'elles ne soient pas lues à voix haute.
- Lignes de séparation / marqueurs de section, utilisables comme points de saut (← / →).

### F44 — Caler un discours sur une durée cible
- L'utilisateur saisit une **durée cible** (ex. 3 min) : l'application calcule et propose la vitesse correspondante.
- Affichage, en fin de lecture, de l'écart entre la durée réelle et la durée cible.

---

## 7. Évolutions ultérieures — P3

### F56 — Mise en forme légère (Markdown) — validée
La mise en forme du texte s'appuie sur la syntaxe **Markdown**, limitée à un sous-ensemble utile à la lecture.

**Éléments pris en charge**

| Élément | Syntaxe | Rendu dans le prompteur |
|---|---|---|
| Gras | `**texte**` | Texte en gras |
| Italique | `*texte*` | Texte en italique |
| Surlignage | `==texte==` | Texte sur fond coloré (mots à appuyer) |
| Titre de section | `# Titre`, `## Sous-titre` | Titre distinct ; sert de marqueur de section pour les sauts ← / → (cf. F43) |
| Séparateur | `---` | Ligne horizontale ; marqueur de section |
| Liste | `- élément`, `1. élément` | Liste à puces ou numérotée |

Tout autre élément Markdown (liens, images, tableaux, code…) est affiché comme du texte brut.

**Éditeur**
- L'utilisateur met en forme soit en tapant directement la syntaxe Markdown, soit via une **barre d'outils** (Gras, Italique, Surligner, Titre, Liste, Séparateur) et les raccourcis usuels (Ctrl+B, Ctrl+I…).
- La barre d'outils est utilisable au doigt sur tablette et smartphone.
- L'éditeur montre la mise en forme pendant la saisie (le mode d'affichage exact — rendu direct ou aperçu côte à côte — sera choisi avec la spec technique).

**Prompteur**
- Le texte est affiché avec sa mise en forme ; les marqueurs de syntaxe ne sont jamais visibles.
- La couleur de surlignage suit le thème d'affichage (F41).

### Idées à valider

| # | Idée |
|---|---|
| F50 | **Historique des enregistrements audio** liés à un prompt, réécoutables dans l'application (au lieu du seul téléchargement). |
| F51 | **Enregistrement vidéo** via webcam, avec le texte affiché à côté de l'objectif. |
| F52 | **Défilement asservi à la voix** : le texte avance en suivant la parole détectée. |
| F53 | **Télécommande depuis un smartphone** sur le même réseau local. |
| F54 | **Écran de lecture séparé** : éditeur/contrôles sur un écran, prompteur sur un second écran ou une seconde fenêtre. |
| F55 | **Dossiers / étiquettes** pour organiser la bibliothèque. |
| F57 | Interface multilingue (FR/EN). |

---

## 8. Parcours utilisateur principaux

### P1 — Première utilisation
1. L'utilisateur ouvre l'application : éditeur vide, paramètres par défaut.
2. Il colle son texte ; le nombre de mots et la durée estimée s'affichent.
3. Il clique sur « Prompt ! » : le prompteur s'ouvre, texte en zone de lecture.
4. Il appuie sur Espace : (compte à rebours) puis le texte défile.
5. Il ajuste la vitesse avec ↑/↓ ; la lecture s'arrête seule en fin de texte.
6. Il ferme le prompteur (Échap), revient à l'éditeur, enregistre (Ctrl+S) et nomme son prompt « Discours mariage ».

### P2 — Reprendre un prompt existant
1. L'utilisateur ouvre « Mes prompts », recherche « mariage ».
2. Il clique sur « Lancer » : le prompteur s'ouvre avec la vitesse, la taille et le miroir enregistrés.
3. Si une lecture précédente avait été interrompue, l'application propose de reprendre à la position mémorisée.

### P3 — Répétition avec enregistrement
1. Depuis le prompteur, l'utilisateur active « Enregistrement audio » et accepte l'accès au micro.
2. Play → enregistrement ; Pause → enregistrement en pause ; fin du texte → enregistrement terminé, fichier proposé au téléchargement.
3. Il ajuste la vitesse, ferme, l'indicateur « modifié » apparaît, il enregistre le prompt avec la nouvelle vitesse.

### P4 — Utilisation avec un téléprompteur physique
1. L'utilisateur active Miroir dans le prompteur, passe en plein écran, pilote avec une télécommande Bluetooth (Page ↑/↓, Espace).
2. Le réglage Miroir est enregistré avec le prompt et réappliqué à la prochaine ouverture.

### P5 — Changer d'appareil
1. Sur l'appareil A : « Mes prompts » → Exporter tout → fichier.
2. Sur l'appareil B : Importer → les prompts et leurs paramètres sont restaurés.

### P6 — Partager un prompt par lien
1. Dans l'éditeur, l'utilisateur clique sur « Copier le lien » et envoie le lien à un intervenant.
2. L'intervenant ouvre le lien sur sa tablette : l'application s'ouvre avec le texte et les paramètres ; il lance la lecture ou enregistre le prompt dans sa bibliothèque.
3. Pour un texte long, l'utilisateur enregistre le prompt dans Google Drive, rend le fichier accessible par lien et partage le « lien Drive ».

---

## 9. Récapitulatif des paramètres d'un prompt

| Paramètre | Valeurs | Défaut | Priorité |
|---|---|---|---|
| Unité de vitesse | mots/minute / pixels/seconde | mots/minute | P1 |
| Vitesse | 60 – 250 mots/min ou 4 – 200 px/s | 140 mots/min (48 px/s) | P1 |
| Taille du texte | 1 – 20 (× 8 px) | 10 | P1 |
| Miroir horizontal | oui / non | non | P1 |
| Inversion verticale | oui / non | non | P1 |
| Enregistrement audio | oui / non | non | P1 |
| Compte à rebours | 0 – 10 s | 3 s | P2 |
| Couleur du texte / du fond | couleurs, thèmes | blanc / noir | P2 |
| Interligne | à définir | à définir | P2 |
| Largeur de colonne | à définir | à définir | P2 |
| Alignement | gauche / centré | gauche | P2 |
| Position de la zone de lecture | haut / centre / libre | ≈ 1/3 supérieur | P2 |
| Police | liste courte | police système | P2 |
| Durée cible | durée ou aucune | aucune | P2 |

---

## 10. Hors périmètre (pour cette version)

- Comptes utilisateurs propres à l'application, synchronisation automatique entre appareils, édition collaborative (le partage se limite aux liens F28/F29 et aux fichiers F24).
- Enregistrement automatique des prompts dans la bibliothèque (seul le brouillon est conservé, cf. F23).
- Conservation des enregistrements audio dans l'application : ils sont uniquement proposés au téléchargement (cf. F10 ; F50 reste une idée).
- Choix techniques (seront traités dans la spec technique) : type d'application (web locale, PWA, application de bureau), mode de stockage, format du fichier d'export, formats audio.

---

## 11. Décisions

| # | Sujet | Décision | Sections |
|---|---|---|---|
| D1 | Unité de vitesse | Au choix : mots/minute ou pixels/seconde. **Mots/minute par défaut.** | F5, F8, F27 |
| D2 | Mise en forme du texte | Mise en forme légère au format **Markdown**, avec éditeur dédié. Texte stocké en Markdown dès P1 ; rendu de la mise en forme en P3. | F1, F56 |
| D3 | Enregistrement automatique | Pas d'enregistrement automatique pour l'instant ; seul le brouillon est conservé. | F23 |
| D4 | Enregistrements audio | Simple téléchargement pour l'instant. | F10 |
| D5 | Appareils cibles | Ordinateur, tablette et smartphone. | §1, F31 |
| D6 | Priorités | Inchangées. | — |
| D7 | Vitesse par défaut | 140 mots/min, plage 60–250 mots/min (pas de 5). | F5 |
| D8 | Sous-ensemble Markdown | Gras, italique, surlignage, titres, séparateur, listes ; tout le reste affiché en texte brut. | F56 |
| D9 | Restauration par URL | Chargement d'un prompt via un lien contenant le prompt compressé, ou via un lien vers un fichier Google Drive. | F28, F29 |
| D10 | Google Drive | Enregistrement et ouverture de prompts dans Google Drive, sur action explicite. | F29, F26 |
