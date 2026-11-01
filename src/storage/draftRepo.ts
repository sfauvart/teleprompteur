import { normalizeSettings } from '../domain/settings';
import { db } from './db';
import type { Draft } from './types';

export async function loadDraft(): Promise<Draft | undefined> {
  const draft = await db.draft.get('current');
  return draft && { ...draft, settings: normalizeSettings(draft.settings) };
}

export async function saveDraft(draft: Draft): Promise<void> {
  await db.draft.put(draft);
}
