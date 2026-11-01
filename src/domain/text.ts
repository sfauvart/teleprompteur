/**
 * Texte brut (spec technique §8.3). En P1 le texte est affiché tel que saisi ; la suppression
 * de la syntaxe Markdown arrivera avec F56.
 */
export function toPlainText(source: string): string {
  return source;
}

const TITLE_MAX_WORDS = 6;
const TITLE_MAX_LENGTH = 60;

/** Titre par défaut : les 6 premiers mots du texte, tronqués à 60 caractères. */
export function defaultTitle(source: string): string {
  const words = toPlainText(source)
    .replace(/\[[^\]\n]*\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, TITLE_MAX_WORDS)
    .join(' ');
  if (words.length <= TITLE_MAX_LENGTH) return words;
  return words.slice(0, TITLE_MAX_LENGTH - 1).trimEnd() + '…';
}

/** Empreinte FNV-1a 32 bits, pour détecter un changement de texte (reprise de lecture, Drive). */
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
