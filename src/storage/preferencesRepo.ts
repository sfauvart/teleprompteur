import { DEFAULT_SETTINGS, normalizeSettings } from '../domain/settings';
import { db } from './db';
import type { Preferences } from './types';

export const DEFAULT_PREFERENCES: Preferences = {
  id: 'default',
  defaultSettings: DEFAULT_SETTINGS,
  driveFolderId: null,
};

export async function loadPreferences(): Promise<Preferences> {
  const stored = await db.preferences.get('default');
  if (!stored) return DEFAULT_PREFERENCES;
  return { ...stored, defaultSettings: normalizeSettings(stored.defaultSettings) };
}

export async function savePreferences(preferences: Preferences): Promise<void> {
  await db.preferences.put(preferences);
}
