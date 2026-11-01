/** Indications scéniques entre crochets (F43) : affichées mais non prononcées. */
const STAGE_DIRECTION = /\[[^\]\n]*\]/g;

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('fr', { granularity: 'word' })
    : null;

/** Décompte des mots à prononcer (spec technique §8.3). */
export function countWords(text: string): number {
  const spoken = text.replace(STAGE_DIRECTION, ' ');
  if (!segmenter) return spoken.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  let count = 0;
  for (const segment of segmenter.segment(spoken)) {
    if (segment.isWordLike) count++;
  }
  return count;
}

const memo = new Map<string, number>();

/** Version mémoïsée (dernier texte uniquement, appelée à chaque frappe). */
export function countWordsMemo(text: string): number {
  const cached = memo.get(text);
  if (cached !== undefined) return cached;
  const result = countWords(text);
  memo.clear();
  memo.set(text, result);
  return result;
}
