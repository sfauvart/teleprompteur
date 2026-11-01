import { memo, useMemo } from 'react';
import { splitBlocks, type Block } from '../../domain/blocks';

interface PrompterContentProps {
  text: string;
  /** Hauteur de ligne (multiplicateur), utilisée pour les espacements entre blocs. */
  lineHeight: number;
}

/**
 * Texte du prompteur découpé en blocs `data-block` (ancres de position, spec technique §7.6).
 * Mémoïsé : ne se re-rend que si le texte change, jamais pendant le défilement.
 */
export const PrompterContent = memo(function PrompterContent({
  text,
  lineHeight,
}: PrompterContentProps) {
  const blocks = useMemo(() => splitBlocks(text), [text]);
  return (
    <>
      {blocks.map((block, index) =>
        block.kind === 'paragraph' ? (
          <p key={index} className="prompter-block" data-block={index} data-paragraph="">
            {block.text}
          </p>
        ) : (
          <div
            key={index}
            className="prompter-block"
            data-block={index}
            style={{ height: `${block.lines * lineHeight}em` }}
            aria-hidden="true"
          />
        ),
      )}
    </>
  );
});

/** Même structure que `PrompterContent`, construite hors React pour la mesure. */
function appendBlocks(container: HTMLElement, blocks: Block[], lineHeight: number): void {
  blocks.forEach((block, index) => {
    const el = document.createElement(block.kind === 'paragraph' ? 'p' : 'div');
    el.className = 'prompter-block';
    el.dataset.block = String(index);
    if (block.kind === 'paragraph') el.textContent = block.text;
    else el.style.height = `${block.lines * lineHeight}em`;
    container.appendChild(el);
  });
}

/**
 * Hauteur du texte tel qu'il serait affiché dans le prompteur, pour la largeur de fenêtre
 * courante : durée estimée en px/s depuis l'éditeur (F1, F8).
 */
export function measureDistance(text: string, fontSizePx: number, lineHeight: number): number {
  const host = document.createElement('div');
  host.className = 'prompter-measure';
  host.style.width = `${window.innerWidth}px`;
  const content = document.createElement('div');
  content.className = 'prompter-text';
  content.style.fontSize = `${fontSizePx}px`;
  content.style.setProperty('--line-height', String(lineHeight));
  appendBlocks(content, splitBlocks(text), lineHeight);
  host.appendChild(content);
  document.body.appendChild(host);
  const height = content.offsetHeight;
  host.remove();
  return height;
}
