import { useEffect, useRef } from 'react';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderExtension } from '@codemirror/view';

interface CodeEditorProps {
  value: string;
  onChange(value: string): void;
  placeholder: string;
  onLaunch(): void;
  onSave(): void;
  ariaLabel: string;
}

const theme = EditorView.theme(
  {
    '&': { color: 'var(--editor-text)', backgroundColor: 'var(--editor-bg)', fontSize: '17px' },
    '.cm-content': {
      fontFamily: 'var(--font-text)',
      lineHeight: '1.6',
      padding: '1rem',
      minHeight: '15rem',
      caretColor: 'var(--accent)',
    },
    '.cm-scroller': { fontFamily: 'var(--font-text)' },
    '&.cm-focused': { outline: '2px solid var(--accent)', outlineOffset: '-2px' },
    '.cm-placeholder': { color: 'var(--muted)' },
    '.cm-cursor': { borderLeftColor: 'var(--accent)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--selection)',
    },
  },
  { dark: true },
);

/**
 * Éditeur CodeMirror 6 (spec technique §8.1) : retour à la ligne automatique, hauteur qui suit
 * le contenu, historique, Ctrl/Cmd+Entrée pour lancer, Ctrl/Cmd+S pour enregistrer.
 */
export function CodeEditor({
  value,
  onChange,
  placeholder,
  onLaunch,
  onSave,
  ariaLabel,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onLaunch, onSave });
  useEffect(() => {
    callbacks.current = { onChange, onLaunch, onSave };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([
            { key: 'Mod-Enter', run: () => (callbacks.current.onLaunch(), true) },
            { key: 'Mod-s', run: () => (callbacks.current.onSave(), true), preventDefault: true },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.lineWrapping,
          placeholderExtension(placeholder),
          EditorView.contentAttributes.of({
            spellcheck: 'false',
            autocapitalize: 'sentences',
            'aria-label': ariaLabel,
            'aria-multiline': 'true',
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
          }),
          theme,
          EditorView.cspNonce.of(__CSP_NONCE__),
        ],
      }),
    });
    viewRef.current = view;
    view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Création unique ; la valeur externe est synchronisée par l'effet suivant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronisation quand le texte change de l'extérieur (ouverture d'un prompt, import, lien).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div ref={hostRef} className="code-editor" />;
}
