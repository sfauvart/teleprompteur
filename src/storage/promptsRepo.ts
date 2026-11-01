import { normalizeSettings, type PromptSettings } from '../domain/settings';
import { db } from './db';
import type { Prompt, PromptStats, ReadingPosition } from './types';

/** Normalise un prompt lu en base : les réglages ajoutés depuis prennent leur valeur par défaut. */
function hydrate(prompt: Prompt): Prompt {
  return { ...prompt, settings: normalizeSettings(prompt.settings) };
}

export async function listPrompts(): Promise<Prompt[]> {
  return (await db.prompts.toArray()).map(hydrate);
}

export async function getPrompt(id: string): Promise<Prompt | undefined> {
  const prompt = await db.prompts.get(id);
  return prompt && hydrate(prompt);
}

export interface PromptInput {
  title: string;
  text: string;
  settings: PromptSettings;
  stats: PromptStats;
}

export async function createPrompt(input: PromptInput, now = new Date()): Promise<Prompt> {
  const timestamp = now.toISOString();
  const prompt: Prompt = {
    id: crypto.randomUUID(),
    ...input,
    lastPosition: null,
    drive: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastUsedAt: null,
  };
  await db.prompts.add(prompt);
  return prompt;
}

export async function updatePrompt(
  id: string,
  input: PromptInput,
  now = new Date(),
): Promise<Prompt> {
  const existing = await db.prompts.get(id);
  if (!existing) throw new Error(`Prompt introuvable : ${id}`);
  const prompt: Prompt = { ...existing, ...input, updatedAt: now.toISOString() };
  await db.prompts.put(prompt);
  return prompt;
}

export async function renamePrompt(id: string, title: string, now = new Date()): Promise<void> {
  await db.prompts.update(id, { title, updatedAt: now.toISOString() });
}

export async function duplicatePrompt(id: string, title: string): Promise<Prompt> {
  const source = await getPrompt(id);
  if (!source) throw new Error(`Prompt introuvable : ${id}`);
  return createPrompt({ title, text: source.text, settings: source.settings, stats: source.stats });
}

export async function deletePrompt(id: string): Promise<void> {
  await db.prompts.delete(id);
}

/** Position de lecture et date d'utilisation : métadonnées, sans changer `updatedAt`. */
export async function setLastPosition(id: string, position: ReadingPosition | null): Promise<void> {
  await db.prompts.update(id, { lastPosition: position });
}

export async function touchLastUsed(id: string, now = new Date()): Promise<void> {
  await db.prompts.update(id, { lastUsedAt: now.toISOString() });
}

export async function putPrompts(prompts: Prompt[]): Promise<void> {
  await db.prompts.bulkPut(prompts);
}
