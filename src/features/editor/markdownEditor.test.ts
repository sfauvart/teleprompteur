import { describe, expect, it } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { insertSeparator, toggleLinePrefix, toggleWrap } from './markdownEditor';

function apply(doc: string, from: number, to: number, command: ReturnType<typeof toggleWrap>) {
  const state = EditorState.create({ doc, selection: EditorSelection.range(from, to) });
  const result = state.update(command(state)!).state;
  return { doc: result.doc.toString(), selection: result.selection.main };
}

describe('commandes de mise en forme (F56)', () => {
  it('encadre puis désencadre la sélection', () => {
    const bold = toggleWrap('**');
    const once = apply('un mot ici', 3, 6, bold);
    expect(once.doc).toBe('un **mot** ici');
    expect([once.selection.from, once.selection.to]).toEqual([5, 8]);
    expect(apply(once.doc, 5, 8, bold).doc).toBe('un mot ici');
    expect(apply('un **mot** ici', 3, 10, bold).doc).toBe('un mot ici');
  });

  it('sans sélection, place le curseur entre les marqueurs', () => {
    const result = apply('ab', 1, 1, toggleWrap('=='));
    expect(result.doc).toBe('a====b');
    expect(result.selection.head).toBe(3);
  });

  it('fait tourner les niveaux de titre', () => {
    const heading = toggleLinePrefix('heading');
    let doc = 'Intro';
    const levels: string[] = [];
    for (let i = 0; i < 4; i++) {
      doc = apply(doc, 0, 0, heading).doc;
      levels.push(doc);
    }
    expect(levels).toEqual(['# Intro', '## Intro', '### Intro', 'Intro']);
  });

  it('numérote les lignes sélectionnées et bascule les puces', () => {
    expect(apply('a\nb\nc', 0, 5, toggleLinePrefix('ordered')).doc).toBe('1. a\n2. b\n3. c');
    expect(apply('- a\n- b', 0, 7, toggleLinePrefix('bullet')).doc).toBe('a\nb');
    expect(apply('1. a', 0, 0, toggleLinePrefix('bullet')).doc).toBe('- a');
  });

  it('insère un séparateur après la ligne courante', () => {
    expect(apply('a\nb', 0, 0, insertSeparator).doc).toBe('a\n\n---\n\n\nb');
  });
});
