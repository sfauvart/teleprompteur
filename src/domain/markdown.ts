import markdownIt, { type MarkdownIt, type StateInline, type Token } from 'markdown-it';
import markPlugin from 'markdown-it-mark';

/**
 * Mise en forme légère (F56, décision D8) : gras, italique, surlignage `==…==`, titres,
 * séparateurs, listes. Tout le reste (liens, images, code, citations, tableaux, HTML) reste
 * affiché comme du texte. Les indications scéniques `[…]` (F43) sont reconnues en ligne.
 */

export interface Inline {
  text: string;
  strong?: boolean;
  em?: boolean;
  mark?: boolean;
  stage?: boolean;
}

export type MarkdownBlock =
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'heading'; level: number; inlines: Inline[] }
  | { kind: 'hr' }
  | { kind: 'list'; ordered: boolean; start: number; items: ListItem[] }
  | { kind: 'spacer'; lines: number };

export interface ListItem {
  depth: number;
  inlines: Inline[];
}

/** Règle en ligne `[…]` : jeton `stage` (les liens sont désactivés, `[` est libre). */
function stageRule(state: StateInline, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x5b /* [ */) return false;
  const end = state.src.indexOf(']', state.pos + 1);
  const newline = state.src.indexOf('\n', state.pos + 1);
  if (end < 0 || (newline >= 0 && newline < end)) return false;
  if (!silent) {
    const token = state.push('stage', '', 0);
    token.content = state.src.slice(state.pos, end + 1);
  }
  state.pos = end + 1;
  return true;
}

function createParser(): MarkdownIt {
  const md = markdownIt('commonmark', {
    html: false,
    linkify: false,
    typographer: false,
    breaks: true,
  });
  md.use(markPlugin);
  // Les règles absentes de D8 sont désactivées : leur syntaxe s'affiche telle quelle.
  md.disable([
    'code',
    'fence',
    'blockquote',
    'html_block',
    'reference',
    'lheading',
    'link',
    'image',
    'autolink',
    'html_inline',
    'backticks',
    'entity',
  ]);
  md.inline.ruler.before('emphasis', 'stage', stageRule);
  return md;
}

let parser: MarkdownIt | null = null;
const getParser = () => (parser ??= createParser());

function inlinesOf(token: Token | undefined): Inline[] {
  const inlines: Inline[] = [];
  const style = { strong: false, em: false, mark: false };
  const push = (text: string, stage = false) => {
    if (!text) return;
    const current: Inline = { text };
    if (style.strong) current.strong = true;
    if (style.em) current.em = true;
    if (style.mark) current.mark = true;
    if (stage) current.stage = true;
    const last = inlines[inlines.length - 1];
    const same =
      last &&
      !!last.strong === !!current.strong &&
      !!last.em === !!current.em &&
      !!last.mark === !!current.mark &&
      !last.stage &&
      !stage;
    if (same) last.text += text;
    else inlines.push(current);
  };
  for (const child of token?.children ?? []) {
    switch (child.type) {
      case 'strong_open':
      case 'strong_close':
        style.strong = child.type === 'strong_open';
        break;
      case 'em_open':
      case 'em_close':
        style.em = child.type === 'em_open';
        break;
      case 'mark_open':
      case 'mark_close':
        style.mark = child.type === 'mark_open';
        break;
      case 'stage':
        push(child.content, true);
        break;
      case 'softbreak':
      case 'hardbreak':
        push('\n');
        break;
      default:
        push(child.content);
    }
  }
  return inlines;
}

/**
 * Découpe le texte en blocs d'affichage. Les lignes vides au-delà de la séparation normale
 * deviennent des espacements (spec technique §8.2).
 */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const text = source.replace(/\r\n?/g, '\n');
  const tokens = getParser().parse(text, {});
  const blocks: MarkdownBlock[] = [];
  let previousEnd: number | null = null;

  const addGap = (startLine: number) => {
    const blankLines = previousEnd === null ? startLine : startLine - previousEnd - 1;
    if (blankLines > 0 && previousEnd === null) blocks.push({ kind: 'spacer', lines: blankLines });
    else if (blankLines > 1) blocks.push({ kind: 'spacer', lines: blankLines - 1 });
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.level !== 0 || !token.map) continue;
    const [start, end] = token.map;
    switch (token.type) {
      case 'paragraph_open':
        addGap(start);
        blocks.push({ kind: 'paragraph', inlines: inlinesOf(tokens[i + 1]) });
        break;
      case 'heading_open':
        addGap(start);
        blocks.push({
          kind: 'heading',
          level: Number(token.tag.slice(1)),
          inlines: inlinesOf(tokens[i + 1]),
        });
        break;
      case 'hr':
        addGap(start);
        blocks.push({ kind: 'hr' });
        break;
      case 'bullet_list_open':
      case 'ordered_list_open': {
        addGap(start);
        const items: ListItem[] = [];
        let depth = -1;
        let j = i + 1;
        for (; j < tokens.length; j++) {
          const t = tokens[j]!;
          if (
            t.level === 0 &&
            (t.type === 'bullet_list_close' || t.type === 'ordered_list_close')
          ) {
            break;
          }
          if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') depth++;
          if (t.type === 'bullet_list_close' || t.type === 'ordered_list_close') depth--;
          if (t.type === 'inline') items.push({ depth: depth + 1, inlines: inlinesOf(t) });
        }
        blocks.push({
          kind: 'list',
          ordered: token.type === 'ordered_list_open',
          start: Number(token.attrGet('start') ?? 1),
          items,
        });
        i = j;
        break;
      }
      default:
        continue;
    }
    previousEnd = end - 1;
  }
  return blocks;
}

const inlineText = (inlines: Inline[]) => inlines.map((i) => i.text).join('');

/** Texte brut sans syntaxe (export .txt, titre par défaut, spec technique §8.3). */
export function toPlainText(source: string): string {
  return parseMarkdown(source)
    .map((block) => {
      switch (block.kind) {
        case 'paragraph':
        case 'heading':
          return inlineText(block.inlines);
        case 'hr':
          return '';
        case 'spacer':
          return '\n'.repeat(block.lines - 1);
        case 'list':
          return block.items
            .map(
              (item, index) =>
                `${'  '.repeat(item.depth)}${block.ordered ? `${block.start + index}.` : '-'} ${inlineText(item.inlines)}`,
            )
            .join('\n');
      }
    })
    .join('\n\n');
}

/** Texte prononcé : sans syntaxe ni puces ou numéros de liste (décompte des mots). */
export function toSpokenText(source: string): string {
  return parseMarkdown(source)
    .flatMap((block) => {
      switch (block.kind) {
        case 'paragraph':
        case 'heading':
          return [inlineText(block.inlines)];
        case 'list':
          return block.items.map((item) => inlineText(item.inlines));
        default:
          return [];
      }
    })
    .join('\n');
}
