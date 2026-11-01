import type { PromptSettings } from '../domain/settings';

export interface ReadingPosition {
  /** Bloc (paragraphe) en face de la ligne de lecture. */
  blockIndex: number;
  /** Position dans ce bloc, de 0 à 1. */
  fraction: number;
  /** Empreinte du texte au moment de la sauvegarde. */
  textHash: string;
}

/** Lien vers un fichier Google Drive (F29, P2). */
export interface DriveLink {
  fileId: string;
  modifiedTime: string;
  contentHash: string;
  canEdit: boolean;
}

export interface PromptStats {
  wordCount: number;
  estimatedDurationSec: number;
}

export interface Prompt {
  id: string;
  title: string;
  /** Source Markdown. */
  text: string;
  settings: PromptSettings;
  lastPosition: ReadingPosition | null;
  stats: PromptStats;
  drive: DriveLink | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface Draft {
  id: 'current';
  /** null = prompt jamais enregistré. */
  promptId: string | null;
  title: string;
  text: string;
  settings: PromptSettings;
  /** updatedAt du prompt enregistré au moment du chargement. */
  baseUpdatedAt: string | null;
  drive: DriveLink | null;
}

export interface Preferences {
  id: 'default';
  defaultSettings: PromptSettings;
  driveFolderId: string | null;
}
