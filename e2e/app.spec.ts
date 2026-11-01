import { expect, test, type Page } from '@playwright/test';

const TEXT = `Mesdames et messieurs, bonsoir.

Merci d'être venus si nombreux ce soir pour célébrer cet événement.

Je voudrais commencer par remercier toutes les personnes qui ont rendu cette soirée possible.`;

async function typeText(page: Page, text: string) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.insertText(text);
}

async function openPrompter(page: Page) {
  await page.getByRole('button', { name: 'Prompt !' }).click();
  await expect(page.locator('.prompter')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.cm-content')).toBeVisible();
});

test('P1 — saisie, lancement, lecture, fermeture', async ({ page, isMobile }) => {
  await typeText(page, TEXT);
  await expect(page.locator('.editor-stats')).toContainText('29 mots');
  await expect(page.locator('.editor-stats')).toContainText('140 mots/min');

  await openPrompter(page);
  await expect(page.locator('.prompter-block').first()).toContainText('Mesdames et messieurs');
  await expect(page.locator('.reading-zone')).toBeVisible();

  const play = page.getByRole('button', { name: 'Lecture', exact: true });
  await play.click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  const transform = await page.locator('.prompter-scroll').evaluate((el) => el.style.transform);
  expect(transform).toMatch(/translate3d\(0px?, -?[\d.]+px, 0px?\)/);

  if (!isMobile) {
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Lecture', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  } else {
    await page.getByRole('button', { name: 'Fermer le prompteur' }).click();
  }
  await expect(page.locator('.prompter')).toHaveCount(0);
  await expect(page.locator('.cm-content')).toContainText('Mesdames et messieurs');
});

test('F2 — texte vide refusé avec un message', async ({ page }) => {
  await page.getByRole('button', { name: 'Prompt !' }).click();
  await expect(page.getByRole('alert')).toContainText('Saisissez un texte');
  await expect(page.locator('.prompter')).toHaveCount(0);
});

test('F30 — raccourcis clavier du prompteur', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Raccourcis clavier : ordinateur');
  await typeText(page, TEXT);
  await openPrompter(page);

  const speed = page.getByRole('textbox', { name: 'Vitesse (mots/min)' });
  await expect(speed).toHaveValue('140');
  await page.keyboard.press('ArrowUp');
  await expect(speed).toHaveValue('145');

  const size = page.getByRole('textbox', { name: 'Taille du texte' });
  await page.keyboard.press('-');
  await expect(size).toHaveValue('9');

  await page.keyboard.press('m');
  await expect(page.getByRole('switch', { name: /Miroir/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('.prompter-stage')).toHaveAttribute('style', /scale\(-1, 1\)/);

  await page.keyboard.press('?');
  await expect(page.getByRole('heading', { name: 'Raccourcis clavier' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Raccourcis clavier' })).toHaveCount(0);

  // Les réglages modifiés dans le prompteur sont conservés dans le brouillon.
  await page.keyboard.press('Escape');
  await expect(page.locator('.editor-stats')).toContainText('145 mots/min');
  await expect(page.getByText('non enregistré')).toBeVisible();
});

test('F5 — changement d’unité de vitesse', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Contrôle testé sur ordinateur');
  await typeText(page, TEXT);
  await openPrompter(page);
  await page.getByRole('combobox', { name: 'Unité de vitesse' }).selectOption('pxps');
  const speed = page.getByRole('textbox', { name: 'Vitesse (px/s)' });
  const value = Number(await speed.inputValue());
  expect(value % 4).toBe(0);
  expect(value).toBeGreaterThanOrEqual(4);
  expect(value).toBeLessThanOrEqual(200);
});

test('F22/F23 — enregistrement, bibliothèque et restauration du brouillon', async ({ page }) => {
  await typeText(page, TEXT);
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Titre')).toHaveValue(
    "Mesdames et messieurs, bonsoir. Merci d'être",
  );
  await dialog.getByLabel('Titre').fill('Discours de mariage');
  await dialog.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByText('Prompt enregistré.')).toBeVisible();
  await expect(page.getByText('non enregistré')).toHaveCount(0);

  // Modification non enregistrée, puis rechargement : le brouillon est restauré.
  await typeText(page, '\nAjout.');
  await expect(page.getByText('modifié', { exact: true })).toBeVisible();
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator('.cm-content')).toContainText('Ajout.');
  await expect(page.getByText('modifié', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Mes prompts' }).click();
  const card = page.locator('.prompt-card', { hasText: 'Discours de mariage' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('29 mots');

  await page.getByPlaceholder('Rechercher').fill('MARIAGE celebrer');
  await expect(card).toBeVisible();
  await page.getByPlaceholder('Rechercher').fill('anniversaire');
  await expect(page.getByText('Aucun prompt ne correspond')).toBeVisible();
});

test('F23 — confirmation avant de perdre des modifications', async ({ page }) => {
  await typeText(page, TEXT);
  await page.getByRole('button', { name: 'Nouveau', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Modifications non enregistrées');
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.locator('.cm-content')).toContainText('Mesdames');
  await page.getByRole('button', { name: 'Nouveau', exact: true }).click();
  await dialog.getByRole('button', { name: 'Ne pas enregistrer' }).click();
  await expect(page.locator('.cm-content')).not.toContainText('Mesdames');
});

test('F28 / P6 — lien de partage', async ({ page, browserName, isMobile, context }) => {
  test.skip(
    browserName !== 'chromium' || isMobile,
    'Presse-papiers testé sous Chromium ordinateur',
  );
  await typeText(page, TEXT);
  await page.getByRole('button', { name: 'Copier le lien' }).click();
  await expect(page.getByText('Lien copié')).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toMatch(/\/teleprompteur\/#prompt=1\./);

  const other = await context.newPage();
  await other.goto(url.replace(/^https?:\/\/[^/]+/, 'http://localhost:4173'));
  await expect(other.getByText('Prompt chargé depuis le lien')).toBeVisible();
  await expect(other.locator('.cm-content')).toContainText('Mesdames et messieurs');
  expect(other.url()).toMatch(/#\/$/);
});

test('F28 — lien corrompu', async ({ page }) => {
  await page.goto('./#prompt=1.nimportequoi');
  await expect(page.getByText('Lien invalide ou corrompu')).toBeVisible();
});

test('F10 — enregistrement audio téléchargé à l’arrêt', async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== 'chromium' || isMobile, 'Micro simulé sous Chromium uniquement');
  await typeText(page, TEXT);
  await openPrompter(page);
  await page.getByRole('switch', { name: /Enregistrement audio/ }).click();
  await expect(page.getByRole('switch', { name: /Enregistrement audio/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Lecture', exact: true }).click();
  await expect(page.locator('.rec-dot')).toBeVisible();
  await page.waitForTimeout(1200);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Stop' }).click();
  expect((await download).suggestedFilename()).toMatch(/^Mesdames-et-messieurs.*\.(webm|m4a|ogg)$/);
});

test('Petit écran — commandes secondaires dans un menu', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mise en page mobile');
  await typeText(page, TEXT);
  await openPrompter(page);
  const mirror = page.getByRole('switch', { name: /Miroir/ });
  await expect(mirror).toBeHidden();
  await page.getByRole('button', { name: 'Autres réglages' }).click();
  await expect(mirror).toBeVisible();
});

test('Hors ligne — l’application se recharge sans réseau', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Service worker testé sous Chromium');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.cm-content')).toBeVisible();
  await context.setOffline(false);
});

test('Sécurité — aucune violation de CSP', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (/Content Security Policy|Content-Security-Policy/i.test(msg.text()))
      violations.push(msg.text());
  });
  await page.reload();
  await typeText(page, TEXT);
  await openPrompter(page);
  await page.waitForTimeout(300);
  expect(violations).toEqual([]);
});

test('F40 — compte à rebours avant le défilement', async ({ page }) => {
  await typeText(page, TEXT);
  await openPrompter(page);
  await page.getByRole('button', { name: 'Lecture', exact: true }).click();
  await expect(page.getByRole('timer')).toContainText('3');
  await expect(page.getByRole('timer')).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});

test('F41 — panneau d’affichage : thème et largeur', async ({ page, isMobile }) => {
  await typeText(page, TEXT);
  await openPrompter(page);
  if (isMobile) await page.getByRole('button', { name: 'Autres réglages' }).click();
  await page.getByRole('button', { name: 'Affichage et lecture' }).click();
  const panel = page.getByRole('dialog', { name: 'Affichage et lecture' });
  await panel.getByRole('radio', { name: 'Noir sur blanc' }).click();
  await expect(page.locator('.prompter')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.prompter-text')).toHaveCSS('color', 'rgb(0, 0, 0)');
  await panel.getByRole('radio', { name: 'Centré' }).click();
  await expect(page.locator('.prompter-text')).toHaveCSS('text-align', 'center');
});

test('F43 — indications scéniques en couleur', async ({ page }) => {
  await typeText(page, 'Bonsoir [sourire] à tous.');
  await expect(page.locator('.cm-stage')).toHaveText('[sourire]');
  await expect(page.locator('.editor-stats')).toContainText('3 mots');
  await openPrompter(page);
  await expect(page.locator('.prompter-text .stage')).toHaveText('[sourire]');
});

test('F42 — barre de progression cliquable', async ({ page }) => {
  await typeText(page, TEXT);
  await openPrompter(page);
  const bar = page.getByRole('slider', { name: 'Progression dans le texte' });
  const box = await bar.boundingBox();
  if (!box) throw new Error('barre absente');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(bar).toHaveAttribute('aria-valuenow', /^(4\d|5\d)$/, { timeout: 3000 });
});

test('F44 — durée cible et vitesse proposée', async ({ page }) => {
  await typeText(page, TEXT);
  const target = page.getByRole('textbox', { name: 'Durée cible' });
  await target.fill('0:10');
  await target.press('Enter');
  await expect(page.getByText('Vitesse pour tenir la durée : 175 mots/min')).toBeVisible();
  await page.getByRole('button', { name: 'Appliquer' }).click();
  await expect(page.locator('.editor-stats')).toContainText('175 mots/min');
  await target.fill('n’importe quoi');
  await target.press('Enter');
  await expect(page.getByText('Durée illisible')).toBeVisible();
});
