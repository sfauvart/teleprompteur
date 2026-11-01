import { Dexie, type EntityTable } from 'dexie';
import type { Draft, Preferences, Prompt } from './types';

/** Base IndexedDB `teleprompteur` (spec technique §5.3). */
export class TeleprompteurDb extends Dexie {
  prompts!: EntityTable<Prompt, 'id'>;
  draft!: EntityTable<Draft, 'id'>;
  preferences!: EntityTable<Preferences, 'id'>;

  constructor(name = 'teleprompteur') {
    super(name);
    this.version(1).stores({
      prompts: 'id, updatedAt, lastUsedAt, title',
      draft: 'id',
      preferences: 'id',
    });
  }
}

export const db = new TeleprompteurDb();

let persistRequested = false;

/** Demande un stockage persistant (non évacuable), une seule fois par session. */
export async function requestPersistentStorage(): Promise<void> {
  if (persistRequested) return;
  persistRequested = true;
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Non bloquant : le stockage reste utilisable sans persistance garantie.
  }
}
