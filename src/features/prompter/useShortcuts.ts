import { useEffect, useRef } from 'react';
import { useDialogs } from '../../ui/feedback';

export interface ShortcutHandlers {
  togglePlay(): void;
  escape(): void;
  speed(direction: 1 | -1): void;
  size(direction: 1 | -1): void;
  page(direction: 1 | -1): void;
  paragraph(direction: 1 | -1): void;
  stop(): void;
  fullscreen(): void;
  mirror(): void;
  invert(): void;
  toggleBar(): void;
  help(): void;
  save(): void;
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/**
 * Raccourcis du prompteur (spec fonctionnelle F30) : un seul écouteur `keydown` sur `window`.
 * Ignorés dans un champ de saisie (sauf Échap) et quand un dialogue est ouvert.
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (useDialogs.getState().current) return;
      const h = ref.current;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        h.save();
        return;
      }
      if (event.key === 'Escape') {
        h.escape();
        return;
      }
      if (isEditable(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;

      const actions: Record<string, () => void> = {
        ' ': h.togglePlay,
        ArrowUp: () => h.speed(1),
        ArrowDown: () => h.speed(-1),
        '+': () => h.size(1),
        '=': () => h.size(1),
        '-': () => h.size(-1),
        PageDown: () => h.page(1),
        PageUp: () => h.page(-1),
        ArrowRight: () => h.paragraph(1),
        ArrowLeft: () => h.paragraph(-1),
        Home: h.stop,
        f: h.fullscreen,
        m: h.mirror,
        i: h.invert,
        h: h.toggleBar,
        '?': h.help,
      };
      const action = actions[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (!action) return;
      event.preventDefault();
      if (event.repeat && (event.key === ' ' || event.key === 'f')) return;
      action();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
