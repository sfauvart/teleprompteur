import {
  HighlightStyle,
  Language,
  LanguageSupport,
  defineLanguageFacet,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state';
import { keymap, type EditorView } from '@codemirror/view';
import { Tag, tags } from '@lezer/highlight';
import { parser as markdownParser, type MarkdownConfig } from '@lezer/markdown';

/** Surlignage `==…==` (F56) : absent de CommonMark, ajouté comme le barré de GFM. */
const markTag = Tag.define();
const MarkDelimiter = { resolve: 'Mark', mark: 'MarkMarker' };

const markExtension: MarkdownConfig = {
  defineNodes: [
    { name: 'Mark', style: { 'Mark/...': markTag } },
    { name: 'MarkMarker', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'Mark',
      parse(cx, next, pos) {
        if (next !== 61 /* = */ || cx.char(pos + 1) !== 61 || cx.char(pos + 2) === 61) return -1;
        const before = cx.slice(pos - 1, pos);
        const after = cx.slice(pos + 2, pos + 3);
        const spaceBefore = /\s|^$/.test(before);
        const spaceAfter = /\s|^$/.test(after);
        return cx.addDelimiter(MarkDelimiter, pos, pos + 2, !spaceAfter, !spaceBefore);
      },
      after: 'Emphasis',
    },
  ],
};

/** Même sous-ensemble que le rendu du prompteur (décision D8, `domain/markdown.ts`). */
const subsetExtension: MarkdownConfig = {
  remove: [
    'LinkReference',
    'IndentedCode',
    'FencedCode',
    'Blockquote',
    'HTMLBlock',
    'SetextHeading',
    'Entity',
    'InlineCode',
    'HTMLTag',
    'Link',
    'Image',
    'LinkEnd',
  ],
};

const highlightStyle = HighlightStyle.define([
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: markTag, backgroundColor: 'rgba(255, 207, 74, 0.28)', borderRadius: '2px' },
  { tag: tags.heading1, fontSize: '1.35em', fontWeight: '700' },
  { tag: tags.heading2, fontSize: '1.2em', fontWeight: '700' },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontWeight: '700' },
  { tag: [tags.processingInstruction, tags.contentSeparator, tags.list], color: 'var(--muted)' },
]);

// --- Commandes de mise en forme (barre d'outils et raccourcis) ---

type FormatCommand = (state: EditorState) => TransactionSpec | null;

/** Encadre la sélection par `marker` (ou retire l'encadrement s'il est déjà présent). */
export function toggleWrap(marker: string): FormatCommand {
  const size = marker.length;
  return (state) =>
    state.changeByRange((range) => {
      const before = state.sliceDoc(range.from - size, range.from);
      const after = state.sliceDoc(range.to, range.to + size);
      if (before === marker && after === marker) {
        return {
          changes: [
            { from: range.from - size, to: range.from },
            { from: range.to, to: range.to + size },
          ],
          range: EditorSelection.range(range.from - size, range.to - size),
        };
      }
      const selected = state.sliceDoc(range.from, range.to);
      if (selected.length >= size * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
        return {
          changes: { from: range.from, to: range.to, insert: selected.slice(size, -size) },
          range: EditorSelection.range(range.from, range.to - size * 2),
        };
      }
      return {
        changes: [
          { from: range.from, insert: marker },
          { from: range.to, insert: marker },
        ],
        range: EditorSelection.range(range.from + size, range.to + size),
      };
    });
}

const LINE_PREFIX = /^(#{1,6} |[-*+] |\d+[.)] )/;

/** Applique (ou retire) un préfixe de ligne : titre, puce, numéro. */
export function toggleLinePrefix(kind: 'heading' | 'bullet' | 'ordered'): FormatCommand {
  return (state) => {
    const lines = new Set<number>();
    for (const range of state.selection.ranges) {
      for (let pos = range.from; pos <= range.to;) {
        const line = state.doc.lineAt(pos);
        lines.add(line.number);
        pos = line.to + 1;
      }
    }
    const changes = [...lines].map((number, index) => {
      const line = state.doc.line(number);
      const current = LINE_PREFIX.exec(line.text)?.[0] ?? '';
      let next: string;
      if (kind === 'heading') {
        // Cycle : rien → # → ## → ### → rien.
        const level = current.startsWith('#') ? current.trim().length : 0;
        next = level >= 3 ? '' : `${'#'.repeat(level + 1)} `;
      } else if (kind === 'bullet') {
        next = /^[-*+] $/.test(current) ? '' : '- ';
      } else {
        next = /^\d+[.)] $/.test(current) ? '' : `${index + 1}. `;
      }
      return { from: line.from, to: line.from + current.length, insert: next };
    });
    return { changes };
  };
}

/** Insère un séparateur `---` entouré de lignes vides après la ligne courante. */
export const insertSeparator: FormatCommand = (state) => {
  const line = state.doc.lineAt(state.selection.main.head);
  const insert = '\n\n---\n\n';
  return {
    changes: { from: line.to, insert },
    selection: EditorSelection.cursor(line.to + insert.length),
  };
};

export function runFormat(view: EditorView, command: FormatCommand): boolean {
  const spec = command(view.state);
  if (!spec) return false;
  view.dispatch(view.state.update(spec, { scrollIntoView: true, userEvent: 'input.format' }));
  view.focus();
  return true;
}

export const FORMAT_COMMANDS = {
  bold: toggleWrap('**'),
  italic: toggleWrap('*'),
  mark: toggleWrap('=='),
  heading: toggleLinePrefix('heading'),
  bullet: toggleLinePrefix('bullet'),
  ordered: toggleLinePrefix('ordered'),
  separator: insertSeparator,
} as const;

export type FormatName = keyof typeof FORMAT_COMMANDS;

const formatKeymap = keymap.of([
  { key: 'Mod-b', run: (view) => runFormat(view, FORMAT_COMMANDS.bold) },
  { key: 'Mod-i', run: (view) => runFormat(view, FORMAT_COMMANDS.italic) },
  {
    key: 'Mod-Shift-h',
    run: (view) => runFormat(view, FORMAT_COMMANDS.mark),
    preventDefault: true,
  },
]);

/**
 * Langage construit directement sur l'analyseur Lezer : `@codemirror/lang-markdown` embarquerait
 * HTML, CSS et JavaScript (blocs de code), inutiles ici.
 */
const markdownLanguage = new Language(
  defineLanguageFacet(),
  markdownParser.configure([subsetExtension, markExtension]),
  [],
  'markdown',
);

/** Extensions CodeMirror : coloration Markdown du sous-ensemble et raccourcis (spec technique §8.1). */
export function markdownEditing() {
  return [new LanguageSupport(markdownLanguage), syntaxHighlighting(highlightStyle), formatKeymap];
}
