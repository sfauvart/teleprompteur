import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../domain/settings';
import { computeStats } from '../domain/stats';
import {
  ImportError,
  buildExportFile,
  countConflicts,
  parseExportFile,
  readImportFile,
  resolveImport,
  serializeExportFile,
} from './exchange';
import type { Prompt } from './types';

const prompt: Prompt = {
  id: 'p1',
  title: 'Discours',
  text: 'Bonjour à tous',
  settings: DEFAULT_SETTINGS,
  lastPosition: { blockIndex: 1, fraction: 0.5, textHash: 'x' },
  stats: { wordCount: 3, estimatedDurationSec: 1 },
  drive: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T11:00:00.000Z',
  lastUsedAt: null,
};

const stats = (text: string) => computeStats(text, DEFAULT_SETTINGS);

describe('export / import', () => {
  it('aller-retour sans la position de lecture', () => {
    const file = buildExportFile([prompt], new Date('2026-11-01T12:00:00Z'));
    const parsed = parseExportFile(serializeExportFile(file));
    expect(parsed).toEqual([
      {
        id: 'p1',
        title: 'Discours',
        text: 'Bonjour à tous',
        settings: DEFAULT_SETTINGS,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt,
      },
    ]);
    expect(serializeExportFile(file)).not.toContain('lastPosition');
  });

  it('rejette un fichier invalide', () => {
    expect(() => parseExportFile('pas du json')).toThrow(ImportError);
    expect(() => parseExportFile('{"format":"autre"}')).toThrow(ImportError);
  });

  it('normalise les réglages importés', () => {
    const [item] = parseExportFile(
      JSON.stringify({
        format: 'teleprompteur',
        version: 1,
        exportedAt: 'x',
        prompts: [{ title: 'T', text: 'a', settings: { fontSize: 99 } }],
      }),
    );
    expect(item?.settings.fontSize).toBe(20);
  });

  it('remplace ou garde les deux en cas de conflit', () => {
    const imported = parseExportFile(serializeExportFile(buildExportFile([prompt])));
    const existing = new Set(['p1']);
    expect(countConflicts(imported, existing)).toBe(1);
    const [replaced] = resolveImport(imported, existing, 'replace', stats);
    expect(replaced).toMatchObject({ id: 'p1', title: 'Discours' });
    const [copy] = resolveImport(imported, existing, 'keep-both', stats);
    expect(copy?.id).not.toBe('p1');
    expect(copy?.title).toBe('Discours (copie)');
  });

  it('importe un fichier texte ou Markdown', async () => {
    const file = new File(['# Titre\nTexte'], 'mon-discours.md', { type: 'text/markdown' });
    expect(await readImportFile(file)).toEqual({
      kind: 'text',
      title: 'mon-discours',
      text: '# Titre\nTexte',
    });
    await expect(readImportFile(new File(['x'], 'image.png'))).rejects.toThrow(ImportError);
  });
});
