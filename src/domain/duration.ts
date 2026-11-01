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
