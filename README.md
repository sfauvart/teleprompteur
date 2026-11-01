# Téléprompteur

Téléprompteur hors ligne, installable (PWA) : saisissez un texte, lancez le défilement, enregistrez vos prompts (texte + réglages) dans votre navigateur.

En ligne : https://www.sebastien-fauvart.fr/teleprompteur/

## Documentation

- [Spécification fonctionnelle](SPEC.md)
- [Spécification technique](SPEC-TECHNIQUE.md)
- [Suivi de réalisation](SUIVI.md)

## Développement

Prérequis : Node.js 24+.

```bash
npm install
npm run dev          # http://localhost:5173/teleprompteur/
```

| Commande | Rôle |
|---|---|
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Sert le build (http://localhost:4173/teleprompteur/) |
| `npm run lint` / `npm run format:check` | ESLint / Prettier |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:e2e` | Tests de bout en bout (Playwright, sur le build : lancer `npm run build` avant) |

Navigateurs Playwright : `npx playwright install chromium firefox webkit`.

## Déploiement

Chaque push sur `main` déclenche `.github/workflows/deploy.yml` : vérifications, tests, build, puis publication de `dist/` sur la branche `gh-pages` (GitHub Pages).

## Licence

[MIT](LICENSE)
