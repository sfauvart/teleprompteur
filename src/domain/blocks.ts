/**
 * Découpage du texte en blocs pour l'affichage du prompteur (P1, spec technique §8.2) :
 * paragraphes séparés par des lignes vides ; les lignes vides supplémentaires deviennent
 * des espacements. Les blocs servent aussi d'ancres de position (§7.6).
 */
export type Block = { kind: 'paragraph'; text: string } | { kind: 'spacer'; lines: number };

const isBlank = (line: string) => line.trim() === '';

export function splitBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let blankRun = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };

  for (const line of lines) {
    if (isBlank(line)) {
      flushParagraph();
      blankRun++;
      continue;
    }
    if (blankRun > 0) {
      // Une ligne vide entre deux paragraphes = séparation normale ; au-delà, espacement.
      const extra = blocks.length === 0 ? blankRun : blankRun - 1;
      if (extra > 0) blocks.push({ kind: 'spacer', lines: extra });
      blankRun = 0;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}

export interface Segment {
  text: string;
  /** Indication scénique `[…]` (F43) : affichée dans une autre couleur, non comptée. */
  stage: boolean;
}

const STAGE_DIRECTION = /\[[^\]\n]*\]/g;

/** Découpe un paragraphe en texte à lire et indications scéniques. */
export function splitSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(STAGE_DIRECTION)) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), stage: false });
    segments.push({ text: match[0], stage: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), stage: false });
  return segments;
}
