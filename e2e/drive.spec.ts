import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Google Drive simulé (F29) : script d'authentification remplacé et API REST interceptée.
 * Aucun compte Google réel n'est utilisé.
 */
const GIS_STUB = `
window.google = window.google || {};
window.google.accounts = {
  oauth2: {
    initTokenClient(config) {
      return {
        requestAccessToken() {
          setTimeout(() => config.callback({ access_token: 'jeton-test', expires_in: 3600 }), 0);
        },
      };
    },
    revoke(_token, done) { if (done) done(); },
  },
};`;

interface FakeFile {
  name: string;
  content: string;
  modifiedTime: string;
  public: boolean;
}

function fakeDrive(page: Page) {
  const files = new Map<string, FakeFile>();
  let counter = 0;
  const stamp = () => new Date(Date.now() + counter++ * 1000).toISOString();

  const contentOf = (body: string) => {
    const parts = body.split(/--[^\r\n]+/).filter((p) => p.includes('\r\n\r\n'));
    const metadata = JSON.parse(parts[0]!.split('\r\n\r\n')[1]!.trim()) as { name?: string };
    const content = parts[1]!.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
    return { metadata, content };
  };

  const meta = (id: string, file: FakeFile) => ({
    id,
    name: file.name,
    modifiedTime: file.modifiedTime,
    capabilities: { canEdit: true },
  });

  const handler = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const authorized = request.headers()['authorization'] === 'Bearer jeton-test';
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.pathname === '/drive/v3/files' && request.method() === 'POST') {
      return json({ id: 'dossier-1' });
    }
    if (url.pathname === '/upload/drive/v3/files' && request.method() === 'POST') {
      const { metadata, content } = contentOf(request.postData() ?? '');
      const id = `fichier-${files.size + 1}`;
      files.set(id, { name: metadata.name ?? '', content, modifiedTime: stamp(), public: false });
      return json(meta(id, files.get(id)!));
    }
    const upload = /^\/upload\/drive\/v3\/files\/(.+)$/.exec(url.pathname);
    if (upload && request.method() === 'PATCH') {
      const file = files.get(upload[1]!);
      if (!file) return json({}, 404);
      const { metadata, content } = contentOf(request.postData() ?? '');
      Object.assign(file, { name: metadata.name ?? file.name, content, modifiedTime: stamp() });
      return json(meta(upload[1]!, file));
    }
    if (url.pathname === '/drive/v3/files' && request.method() === 'GET') {
      return json({ files: [...files].map(([id, file]) => meta(id, file)) });
    }
    const single = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname);
    if (single) {
      const file = files.get(single[1]!);
      if (!file || (!authorized && !file.public))
        return json({ error: { message: 'Not found' } }, 404);
      if (url.searchParams.get('alt') === 'media') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: file.content });
      }
      return json(meta(single[1]!, file));
    }
    return json({ error: { message: `non simulé : ${url.pathname}` } }, 500);
  };

  return {
    files,
    async install() {
      await page.route('https://accounts.google.com/gsi/client', (route) =>
        route.fulfill({ contentType: 'text/javascript', body: GIS_STUB }),
      );
      await page.route('https://www.googleapis.com/**', handler);
    },
  };
}

const TEXT = 'Bonsoir à tous.\n\nMerci d’être là.';

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(isMobile, 'Parcours Drive testé sur ordinateur');
  await page.goto('./');
  await expect(page.locator('.cm-content')).toBeVisible();
  const configured = await page.getByRole('button', { name: /Google Drive/ }).count();
  test.skip(configured === 0, 'Identifiants Google absents du build');
});

test('F29 — enregistrer dans Drive puis rouvrir', async ({ page }) => {
  const drive = fakeDrive(page);
  await drive.install();

  await page.locator('.cm-content').click();
  await page.keyboard.insertText(TEXT);
  await page.getByRole('button', { name: /Google Drive/ }).click();
  await page.getByRole('menuitem', { name: 'Enregistrer dans Drive' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titre').fill('Discours Drive');
  await dialog.getByRole('button', { name: 'Valider' }).click();

  await expect(page.getByText('Prompt enregistré dans Google Drive.')).toBeVisible();
  await expect(page.locator('.editor-header .badge.drive')).toHaveText('Drive');
  expect(drive.files.size).toBe(1);
  const stored = [...drive.files.values()][0]!;
  expect(stored.name).toBe('Discours-Drive.teleprompteur.json');
  expect(JSON.parse(stored.content).prompts[0].text).toBe(TEXT);

  // Modification : indicateur, puis mise à jour du même fichier.
  await page.locator('.cm-content').click();
  await page.keyboard.press('End');
  await page.keyboard.insertText(' Bonne soirée.');
  await expect(page.locator('.editor-header .badge.drive')).toHaveText('Drive : modifié');
  await page.getByRole('button', { name: /Google Drive/ }).click();
  await page.getByRole('menuitem', { name: 'Enregistrer dans Drive' }).click();
  await expect(page.locator('.editor-header .badge.drive')).toHaveText('Drive');
  expect(drive.files.size).toBe(1);
  expect([...drive.files.values()][0]!.content).toContain('Bonne soirée.');

  // Nouveau prompt, puis ouverture depuis la liste Drive.
  await page.getByRole('button', { name: 'Nouveau', exact: true }).click();
  await expect(page.locator('.cm-content')).not.toContainText('Bonsoir');
  await page.getByRole('button', { name: /Google Drive/ }).click();
  await page.getByRole('menuitem', { name: 'Ouvrir depuis Drive…' }).click();
  await page.getByRole('button', { name: /Discours-Drive/ }).click();
  await expect(page.getByText('Prompt ouvert depuis Google Drive.')).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('Bonne soirée.');
});

test('F29 — lien #gdrive= vers un fichier public', async ({ page }) => {
  const drive = fakeDrive(page);
  await drive.install();
  drive.files.set('fichier-public-1', {
    name: 'Partage.teleprompteur.json',
    modifiedTime: '2026-11-01T10:00:00.000Z',
    public: true,
    content: JSON.stringify({
      format: 'teleprompteur',
      version: 1,
      exportedAt: '2026-11-01T10:00:00.000Z',
      prompts: [{ title: 'Partagé', text: 'Texte partagé par Drive', settings: {} }],
    }),
  });
  await page.goto('./#gdrive=fichier-public-1');
  await expect(page.getByText('Prompt ouvert depuis Google Drive.')).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('Texte partagé par Drive');
});

test('F29 — lien #gdrive= vers un fichier privé : connexion demandée', async ({ page }) => {
  const drive = fakeDrive(page);
  await drive.install();
  drive.files.set('fichier-prive-1', {
    name: 'Prive.teleprompteur.json',
    modifiedTime: '2026-11-01T10:00:00.000Z',
    public: false,
    content: JSON.stringify({
      format: 'teleprompteur',
      version: 1,
      exportedAt: '2026-11-01T10:00:00.000Z',
      prompts: [{ title: 'Privé', text: 'Texte privé', settings: {} }],
    }),
  });
  await page.goto('./#gdrive=fichier-prive-1');
  await page.getByRole('button', { name: 'Se connecter à Google et ouvrir' }).click();
  await expect(page.locator('.cm-content')).toContainText('Texte privé');
});
