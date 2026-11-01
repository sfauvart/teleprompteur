import { normalizeSettings, type PromptSettings } from '../domain/settings';
import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  exportFileSchema,
  type ExportFile,
  type ExportedPrompt,
} from '../domain/sharedPrompt';
import { titleFromFileName } from '../domain/filename';
import { toPlainText } from '../domain/text';
import type { Prompt, PromptStats } from './types';

/** Taille maximale d'un fichier importé (spec technique §12). */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/** Fichier d'export (spec technique §6.4) ; `lastPosition` et `drive` ne sont pas exportés. */
export function buildExportFile(prompts: Prompt[], now = new Date()): ExportFile {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    prompts: prompts.map(({ id, title, text, settings, createdAt, updatedAt }) => ({
      id,
      title,
      text,
      settings,
      createdAt,
      updatedAt,
    })),
  };
}

export function serializeExportFile(file: ExportFile): string {
  return JSON.stringify(file, null, 2);
}

export class ImportError extends Error {}

export type ImportedFile =
  { kind: 'prompts'; prompts: ExportedPrompt[] } | { kind: 'text'; title: string; text: string };

/** Lit un fichier importé : export JSON, ou texte brut / Markdown. Valide tout avant écriture. */
export async function readImportFile(file: File): Promise<ImportedFile> {
  if (file.size > MAX_IMPORT_BYTES)
    throw new ImportError('Fichier trop volumineux (10 Mo maximum).');
  const content = await file.text();
  if (/\.json$/i.test(file.name)) return { kind: 'prompts', prompts: parseExportFile(content) };
  if (/\.(txt|md|markdown)$/i.test(file.name)) {
    return { kind: 'text', title: titleFromFileName(file.name), text: content };
  }
  throw new ImportError('Format non pris en charge (.json, .md ou .txt attendu).');
}

export function parseExportFile(content: string): ExportedPrompt[] {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new ImportError('Fichier JSON illisible.');
  }
  const result = exportFileSchema.safeParse(json);
  if (!result.success)
    throw new ImportError('Ce fichier n’est pas un export de Téléprompteur valide.');
  return result.data.prompts;
}

export type ConflictStrategy = 'replace' | 'keep-both';

/**
 * Transforme les prompts importés en prompts à écrire.
 * Identifiant déjà présent : remplacé, ou importé sous un nouvel identifiant avec « (copie) ».
 */
export function resolveImport(
  imported: ExportedPrompt[],
  existingIds: ReadonlySet<string>,
  strategy: ConflictStrategy,
  computeStats: (text: string, settings: PromptSettings) => PromptStats,
  now = new Date(),
): Prompt[] {
  const timestamp = now.toISOString();
  return imported.map((item) => {
    const conflict = item.id !== undefined && existingIds.has(item.id);
    const keepBoth = conflict && strategy === 'keep-both';
    const settings = normalizeSettings(item.settings);
    return {
      id: item.id && !keepBoth ? item.id : crypto.randomUUID(),
      title: keepBoth ? `${item.title} (copie)` : item.title,
      text: item.text,
      settings,
      lastPosition: null,
      stats: computeStats(item.text, settings),
      drive: null,
      createdAt: keepBoth ? timestamp : (item.createdAt ?? timestamp),
      updatedAt: keepBoth ? timestamp : (item.updatedAt ?? timestamp),
      lastUsedAt: null,
    };
  });
}

export function countConflicts(
  imported: ExportedPrompt[],
  existingIds: ReadonlySet<string>,
): number {
  return imported.filter((p) => p.id !== undefined && existingIds.has(p.id)).length;
}

export function exportAsText(text: string, format: 'md' | 'txt'): string {
  return format === 'md' ? text : toPlainText(text);
}
