import type { Speed } from './speed';

/**
 * Durée estimée en secondes (spec technique §7.5) :
 * mots/min → mots × 60 / débit ; px/s → distance / vitesse.
 */
export function estimateDurationSec(speed: Speed, distance: number, words: number): number {
  if (speed.unit === 'wpm') return (words * 60) / speed.value;
  return distance > 0 ? distance / speed.value : 0;
}

/** Formate une durée : MM:SS sous une heure, HH:MM:SS au-delà. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Lit une durée saisie : « 3 » (minutes), « 2:30 », « 1:02:00 », « 90s », « 2 min 30 ».
 * Renvoie des secondes, ou null si la saisie est illisible.
 */
export function parseDuration(input: string): number | null {
  const value = input.trim().toLowerCase().replace(',', '.');
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Math.round(Number(value) * 60);
  const clock = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(value);
  if (clock) {
    const [, a, b, c] = clock;
    return c === undefined
      ? Number(a) * 60 + Number(b)
      : Number(a) * 3600 + Number(b) * 60 + Number(c);
  }
  const units = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*(?:min|mn|m))?\s*(?:(\d+)\s*s?)?$/.exec(value);
  if (units && (units[1] || units[2] || units[3])) {
    return Number(units[1] ?? 0) * 3600 + Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0);
  }
  return null;
}

/** Écart signé lisible : « +00:12 », « −01:05 ». */
export function formatGap(seconds: number): string {
  const sign = seconds > 0.5 ? '+' : seconds < -0.5 ? '−' : '±';
  return `${sign}${formatDuration(Math.abs(seconds))}`;
}
