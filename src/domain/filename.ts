const MAX_SLUG_LENGTH = 60;

/** « Discours de mariage ! » → « Discours-de-mariage ». */
export function slugify(title: string, fallback = 'Prompt'): string {
  const slug = title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');
  return slug || fallback;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dateStamp(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function timeStamp(date: Date): string {
  return `${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

/** Nom du fichier audio : `<titre>_<AAAA-MM-JJ>_<HH-mm>.<ext>` (F10). */
export function audioFileName(title: string, date: Date, extension: string): string {
  return `${slugify(title)}_${dateStamp(date)}_${timeStamp(date)}.${extension}`;
}

export function promptExportFileName(title: string): string {
  return `${slugify(title)}.teleprompteur.json`;
}

export function libraryExportFileName(date: Date): string {
  return `teleprompteur-export_${dateStamp(date)}.json`;
}

export function textExportFileName(title: string, extension: 'md' | 'txt'): string {
  return `${slugify(title)}.${extension}`;
}

/** Titre déduit d'un nom de fichier importé : « mon-discours.md » → « mon-discours ». */
export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim() || 'Prompt importé';
}
