import type { RefObject } from 'react';
import type { EditorView } from '@codemirror/view';
import { fr } from '../../i18n/fr';
import { FORMAT_COMMANDS, runFormat, type FormatName } from './markdownEditor';

const BUTTONS: {
  name: FormatName;
  label: string;
  title: string;
  content: string;
  className?: string;
}[] = [
  {
    name: 'bold',
    label: fr.format.bold,
    title: `${fr.format.bold} (Ctrl+B)`,
    content: 'G',
    className: 'bold',
  },
  {
    name: 'italic',
    label: fr.format.italic,
    title: `${fr.format.italic} (Ctrl+I)`,
    content: 'I',
    className: 'italic',
  },
  {
    name: 'mark',
    label: fr.format.mark,
    title: `${fr.format.mark} (Ctrl+Maj+H)`,
    content: 'S',
    className: 'mark',
  },
  { name: 'heading', label: fr.format.heading, title: fr.format.headingHint, content: 'T' },
  { name: 'bullet', label: fr.format.bullet, title: fr.format.bullet, content: '•' },
  { name: 'ordered', label: fr.format.ordered, title: fr.format.ordered, content: '1.' },
  { name: 'separator', label: fr.format.separator, title: fr.format.separator, content: '—' },
];

/** Barre de mise en forme Markdown (F56), utilisable au doigt. */
export function MarkdownToolbar({ view }: { view: RefObject<EditorView | null> }) {
  return (
    <div className="format-toolbar" role="toolbar" aria-label={fr.format.toolbar}>
      {BUTTONS.map((button) => (
        <button
          key={button.name}
          type="button"
          className={`format-btn ${button.className ?? ''}`}
          aria-label={button.label}
          title={button.title}
          // Garde la sélection de l'éditeur.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => view.current && runFormat(view.current, FORMAT_COMMANDS[button.name])}
        >
          {button.content}
        </button>
      ))}
    </div>
  );
}
