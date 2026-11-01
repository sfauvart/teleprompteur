import { describe, expect, it } from 'vitest';
import { countWords } from './words';
import { splitBlocks } from './blocks';
import { defaultTitle, hashText } from './text';
import { audioFileName, slugify, titleFromFileName } from './filename';
import { matchesQuery } from './search';

describe('countWords', () => {
  it('compte les mots français (élisions comprises dans le mot)', () => {
    expect(countWords("Bonjour à tous, aujourd'hui c'est l'été !")).toBe(6);
  });

  it('exclut les indications scéniques', () => {
    expect(countWords('Bonsoir [pause] et bienvenue [regarder caméra]')).toBe(3);
  });

  it('ignore la ponctuation et la syntaxe', () => {
    expect(countWords('**Gras** — ... ---')).toBe(1);
    expect(countWords('')).toBe(0);
  });
});

describe('splitBlocks', () => {
  it('sépare les paragraphes sur les lignes vides', () => {
    expect(splitBlocks('A\nB\n\nC')).toEqual([
      { kind: 'paragraph', text: 'A\nB' },
      { kind: 'paragraph', text: 'C' },
    ]);
  });

  it('conserve les lignes vides supplémentaires', () => {
    expect(splitBlocks('\nA\n\n\n\nB\n\n')).toEqual([
      { kind: 'spacer', lines: 1 },
      { kind: 'paragraph', text: 'A' },
      { kind: 'spacer', lines: 2 },
      { kind: 'paragraph', text: 'B' },
    ]);
  });

  it('normalise les fins de ligne', () => {
    expect(splitBlocks('A\r\n\r\nB')).toHaveLength(2);
  });
});

describe('defaultTitle', () => {
  it('prend les 6 premiers mots', () => {
    expect(defaultTitle('Mesdames et messieurs, chers amis, bonsoir à tous')).toBe(
      'Mesdames et messieurs, chers amis, bonsoir',
    );
  });

  it('tronque à 60 caractères', () => {
    const title = defaultTitle('Anticonstitutionnellement '.repeat(6));
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('hashText', () => {
  it('est stable et sensible au contenu', () => {
    expect(hashText('abc')).toBe(hashText('abc'));
    expect(hashText('abc')).not.toBe(hashText('abd'));
  });
});

describe('noms de fichiers', () => {
  it('slugify', () => {
    expect(slugify('Discours de mariage !')).toBe('Discours-de-mariage');
    expect(slugify('Été à Noël')).toBe('Ete-a-Noel');
    expect(slugify('   ')).toBe('Prompt');
  });

  it('nom du fichier audio', () => {
    expect(audioFileName('Discours mariage', new Date(2026, 10, 1, 14, 32), 'webm')).toBe(
      'Discours-mariage_2026-11-01_14-32.webm',
    );
  });

  it('titre depuis un fichier', () => {
    expect(titleFromFileName('mon-discours.md')).toBe('mon-discours');
  });
});

describe('matchesQuery', () => {
  const prompt = { title: 'Discours de mariage', text: 'Chers amis, merci d’être là' };

  it('ignore accents et casse', () => {
    expect(matchesQuery(prompt, 'MARIAGE etre')).toBe(true);
    expect(matchesQuery(prompt, 'anniversaire')).toBe(false);
    expect(matchesQuery(prompt, '  ')).toBe(true);
  });
});
