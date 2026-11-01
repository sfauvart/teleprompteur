/** Minuscules, sans accents. */
export function normalizeForSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Vrai si chaque terme de la requête apparaît dans le titre ou le texte. */
export function matchesQuery(fields: { title: string; text: string }, query: string): boolean {
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalizeForSearch(`${fields.title}\n${fields.text}`);
  return terms.every((term) => haystack.includes(term));
}
