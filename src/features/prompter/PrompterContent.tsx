import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { parseMarkdown, type Inline, type MarkdownBlock } from '../../domain/markdown';
import { FONTS, fontScale, type PromptSettings } from '../../domain/settings';

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
    ['--font-scale' as string]: String(fontScale(display.fontSize)),
    ['--line-height' as string]: String(display.lineHeight),
    ['--stage-color' as string]: display.theme.stage,
    ['--mark-color' as string]: display.theme.highlight,
    width: `${display.columnWidth}%`,
    fontFamily: FONTS[display.font].stack,
    textAlign: display.align,
    color: display.theme.text,
  };
}

/** Texte mis en forme (F56) : la syntaxe Markdown n'est jamais affichée. */
function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((inline, i) => {
        if (inline.stage) {
          return (
            <span key={i} className="stage">
              {inline.text}
            </span>
          );
        }
        let node: ReactNode = inline.text;
        if (inline.mark) node = <mark>{node}</mark>;
        if (inline.em) node = <em>{node}</em>;
        if (inline.strong) node = <strong>{node}</strong>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

/**
 * Attributs des blocs : `data-block` (ancres de position, spec technique §7.6),
 * `data-paragraph` (sauts ← / →), `data-section` (sauts Maj+← / Maj+→, F43).
 */
function Block({
  block,
  index,
  lineHeight,
}: {
  block: MarkdownBlock;
  index: number;
  lineHeight: number;
}) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <p className="prompter-block" data-block={index} data-paragraph="">
          <Inlines inlines={block.inlines} />
        </p>
      );
    case 'heading': {
      const Tag = `h${Math.min(block.level, 3)}` as 'h1' | 'h2' | 'h3';
      return (
        <Tag
          className="prompter-block heading"
          data-block={index}
          data-paragraph=""
          data-section=""
        >
          <Inlines inlines={block.inlines} />
        </Tag>
      );
    }
    case 'hr':
      return <hr className="prompter-block" data-block={index} data-section="" />;
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className="prompter-block" data-block={index} data-paragraph="" start={block.start}>
          {block.items.map((item, i) => (
            <li key={i} style={{ marginLeft: `${item.depth * 1.2}em` }}>
              <Inlines inlines={item.inlines} />
            </li>
          ))}
        </Tag>
      );
    }
    case 'spacer':
      return (
        <div
          className="prompter-block"
          data-block={index}
          style={{ height: `${block.lines * lineHeight}em` }}
          aria-hidden="true"
        />
      );
  }
}

/**
 * Texte du prompteur, découpé en blocs.
 * Mémoïsé : ne se re-rend que si le texte change, jamais pendant le défilement.
 */
export const PrompterContent = memo(function PrompterContent({
  text,
  lineHeight,
}: PrompterContentProps) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    // Taille relative à la colonne (unités de conteneur `cqi`, voir .prompter-flow).
    <div className="prompter-flow">
      {blocks.map((block, index) => (
        <Block key={index} block={block} index={index} lineHeight={lineHeight} />
      ))}
    </div>
  );
});

/**
 * Hauteur du texte tel qu'il serait affiché dans le prompteur, pour la largeur de fenêtre
 * courante : durée estimée en px/s depuis l'éditeur (F1, F8). Même rendu que le prompteur,
 * dans une racine React détachée.
 */
export function measureDistance(text: string, display: TextDisplay): number {
  const host = document.createElement('div');
  host.className = 'prompter-measure';
  host.style.width = `${window.innerWidth}px`;
  document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() =>
    root.render(
      <div className="prompter-text" style={textStyle(display)}>
        <PrompterContent text={text} lineHeight={display.lineHeight} />
      </div>,
    ),
  );
  const height = (host.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
  root.unmount();
  host.remove();
  return height;
}
