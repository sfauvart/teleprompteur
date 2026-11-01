import { describe, expect, it } from 'vitest';
import { parseMarkdown, toPlainText, toSpokenText } from './markdown';

describe('parseMarkdown (F56)', () => {
  it('reconnaît gras, italique, surlignage et indications scéniques', () => {
    expect(parseMarkdown('Un **mot** *clé* ==fort== [pause] fin')).toEqual([
      {
        kind: 'paragraph',
        inlines: [
          { text: 'Un ' },
          { text: 'mot', strong: true },
          { text: ' ' },
          { text: 'clé', em: true },
          { text: ' ' },
          { text: 'fort', mark: true },
          { text: ' ' },
          { text: '[pause]', stage: true },
          { text: ' fin' },
        ],
      },
    ]);
  });

  it('reconnaît titres, séparateurs et listes', () => {
    const blocks = parseMarkdown('# Intro\n\nTexte\n\n---\n\n- un\n- deux\n  - sous\n\n3. trois');
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'hr', 'list', 'list']);
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 1 });
    expect(blocks[3]).toMatchObject({
      ordered: false,
      items: [
        { depth: 0, inlines: [{ text: 'un' }] },
        { depth: 0, inlines: [{ text: 'deux' }] },
        { depth: 1, inlines: [{ text: 'sous' }] },
      ],
    });
    expect(blocks[4]).toMatchObject({ ordered: true, start: 3 });
  });

  it('affiche tel quel ce qui sort du sous-ensemble', () => {
    const text = (source: string) =>
      parseMarkdown(source).flatMap((b) => ('inlines' in b ? b.inlines.map((i) => i.text) : []));
    expect(text('[lien](https://exemple.fr)')).toEqual(['[lien]', '(https://exemple.fr)']);
    expect(text('`code` et <b>html</b>')).toEqual(['`code` et <b>html</b>']);
    expect(text('> citation')).toEqual(['> citation']);
    expect(text('    indenté')).toEqual(['indenté']);
  });

  it('conserve les retours à la ligne et les lignes vides supplémentaires', () => {
    expect(parseMarkdown('A\nB\n\n\n\nC')).toEqual([
      { kind: 'paragraph', inlines: [{ text: 'A\nB' }] },
      { kind: 'spacer', lines: 2 },
      { kind: 'paragraph', inlines: [{ text: 'C' }] },
    ]);
    expect(parseMarkdown('\n\nA')[0]).toEqual({ kind: 'spacer', lines: 2 });
  });
});

describe('texte brut', () => {
  it('retire la syntaxe', () => {
    expect(toPlainText('# Titre\n\nUn **mot** ==fort==\n\n---\n\n1. un\n2. deux')).toBe(
      'Titre\n\nUn mot fort\n\n\n\n1. un\n2. deux',
    );
  });

  it('texte prononcé sans puces ni numéros', () => {
    expect(toSpokenText('1. un\n2. deux\n\n# Titre')).toBe('un\ndeux\nTitre');
  });
});
