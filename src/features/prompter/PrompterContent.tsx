import { memo, useMemo, type CSSProperties } from 'react';
import { splitBlocks, splitSegments, type Block } from '../../domain/blocks';
import { FONTS, fontSizePx, type PromptSettings } from '../../domain/settings';

interface PrompterContentProps {
  text: string;
  /** Hauteur de ligne (multiplicateur), utilisée pour les espacements entre blocs. */
  lineHeight: number;
}

/** Réglages qui influent sur la mise en page du texte (et donc sur sa hauteur). */
export type TextDisplay = Pick<
  PromptSettings,
  'fontSize' | 'lineHeight' | 'columnWidth' | 'font' | 'align' | 'theme'
>;

/** Style de la colonne de texte, partagé par l'affichage et la mesure (F41). */
export function textStyle(display: TextDisplay): CSSProperties {
  return {
    fontSize: `${fontSizePx(display.fontSize)}px`,
    ['--line-height' as string]: String(display.lineHeight),
    ['--stage-color' as string]: display.theme.stage,
    width: `${display.columnWidth}%`,
    fontFamily: FONTS[display.font].stack,
    textAlign: display.align,
    color: display.theme.text,
  };
}

function Paragraph({ text }: { text: string }) {
  const segments = useMemo(() => splitSegments(text), [text]);
  return (
    <>
      {segments.map((segment, i) =>
        segment.stage ? (
          <span key={i} className="stage">
            {segment.text}
          </span>
        ) : (
          segment.text
        ),
      )}
    </>
  );
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
            <Paragraph text={block.text} />
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
export function measureDistance(text: string, display: TextDisplay): number {
  const host = document.createElement('div');
  host.className = 'prompter-measure';
  host.style.width = `${window.innerWidth}px`;
  const content = document.createElement('div');
  content.className = 'prompter-text';
  Object.assign(content.style, textStyle(display));
  content.style.setProperty('--line-height', String(display.lineHeight));
  appendBlocks(content, splitBlocks(text), display.lineHeight);
  host.appendChild(content);
  document.body.appendChild(host);
  const height = content.offsetHeight;
  host.remove();
  return height;
}
