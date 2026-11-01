import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../domain/settings';
import { db } from '../storage/db';
import { getPrompt, renamePrompt } from '../storage/promptsRepo';
import { isDirty, useSession } from './sessionStore';

const session = () => useSession.getState();

beforeEach(async () => {
  await Promise.all([db.prompts.clear(), db.draft.clear(), db.preferences.clear()]);
  useSession.setState({ ready: false, saved: null, measuredDistance: null });
  await session().init();
});

describe('sessionStore', () => {
  it('démarre sur un brouillon vide, non modifié', () => {
    expect(session().draft).toMatchObject({ promptId: null, text: '', settings: DEFAULT_SETTINGS });
    expect(isDirty(session().draft, session().saved)).toBe(false);
  });

  it('un texte non enregistré est « modifié »', () => {
    session().setText('Bonjour');
    expect(isDirty(session().draft, session().saved)).toBe(true);
  });

  it('demande un titre au premier enregistrement', async () => {
    session().setText('Bonjour à tous');
    expect(await session().save()).toEqual({ status: 'needs-title' });
    const result = await session().save({ title: 'Accueil' });
    expect(result.status).toBe('saved');
    expect(session().draft.promptId).not.toBeNull();
    expect(isDirty(session().draft, session().saved)).toBe(false);
    const stored = await getPrompt(session().draft.promptId!);
    expect(stored).toMatchObject({
      title: 'Accueil',
      text: 'Bonjour à tous',
      stats: { wordCount: 3 },
    });
  });

  it('un réglage changé rend le prompt « modifié »', async () => {
    session().setText('Bonjour');
    await session().save({ title: 'T' });
    session().updateSettings({ mirrorX: true });
    expect(isDirty(session().draft, session().saved)).toBe(true);
  });

  it('détecte une modification faite ailleurs', async () => {
    session().setText('Bonjour');
    await session().save({ title: 'T' });
    const id = session().draft.promptId!;
    await new Promise((r) => setTimeout(r, 5));
    await renamePrompt(id, 'Autre onglet');
    session().setText('Bonjour modifié');
    expect(await session().save()).toEqual({ status: 'conflict' });
    expect((await session().save({ force: true })).status).toBe('saved');
  });

  it('enregistrer sous crée un nouveau prompt', async () => {
    session().setText('Bonjour');
    await session().save({ title: 'Original' });
    const first = session().draft.promptId;
    await session().saveAs('Copie');
    expect(session().draft.promptId).not.toBe(first);
    expect(await db.prompts.count()).toBe(2);
  });

  it('un prompt partagé est chargé comme non enregistré', () => {
    session().loadShared({
      title: 'Lien',
      text: 'Texte',
      settings: { ...DEFAULT_SETTINGS, fontSize: 5 },
    });
    expect(session().draft).toMatchObject({ promptId: null, title: 'Lien', text: 'Texte' });
    expect(session().draft.settings.fontSize).toBe(5);
  });

  it('nouveau prompt : réglages par défaut des préférences', async () => {
    await session().setPreferences({
      ...session().preferences,
      defaultSettings: { ...DEFAULT_SETTINGS, speed: { unit: 'pxps', value: 60 } },
    });
    session().newPrompt();
    expect(session().draft.settings.speed).toEqual({ unit: 'pxps', value: 60 });
  });
});

describe('lien Google Drive', () => {
  it('est conservé à l’enregistrement et signale les modifications', async () => {
    const { driveContentHash, isModifiedSinceDrive } = await import('../app/driveActions');
    session().setText('Bonjour');
    await session().save({ title: 'T' });
    const { draft } = session();
    await session().setDriveLink({
      fileId: 'f1',
      modifiedTime: 't1',
      contentHash: driveContentHash(draft),
      canEdit: true,
    });
    expect(isModifiedSinceDrive(session().draft)).toBe(false);
    expect((await getPrompt(draft.promptId!))?.drive?.fileId).toBe('f1');
    session().setText('Bonjour modifié');
    expect(isModifiedSinceDrive(session().draft)).toBe(true);
    await session().save();
    expect((await getPrompt(draft.promptId!))?.drive?.fileId).toBe('f1');
  });
});
