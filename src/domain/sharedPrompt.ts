import { z } from './zod';
import { settingsSchema } from './settings';

export const MAX_TEXT_LENGTH = 1_000_000;
export const MAX_TITLE_LENGTH = 200;

/** Prompt transporté par un lien, un fichier Drive ou un export (spec technique §5.1). */
export const sharedPromptSchema = z.object({
  title: z.string().max(MAX_TITLE_LENGTH).catch(''),
  text: z.string().max(MAX_TEXT_LENGTH),
  settings: settingsSchema,
});

export type SharedPrompt = z.output<typeof sharedPromptSchema>;

const isoDate = z.string().datetime({ offset: true });

/** Prompt dans un fichier d'export : identifiant et dates en plus. */
export const exportedPromptSchema = sharedPromptSchema.extend({
  id: z.string().min(1).max(100).optional(),
  createdAt: isoDate.optional().catch(undefined),
  updatedAt: isoDate.optional().catch(undefined),
});

export type ExportedPrompt = z.output<typeof exportedPromptSchema>;

export const EXPORT_FORMAT = 'teleprompteur';
export const EXPORT_VERSION = 1;

export const exportFileSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.string(),
  prompts: z.array(exportedPromptSchema).max(10_000),
});

export type ExportFile = z.output<typeof exportFileSchema>;
