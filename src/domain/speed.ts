import { SPEED_LIMITS, clampSpeed, type SpeedUnit } from './settings';

export interface Speed {
  unit: SpeedUnit;
  value: number;
}

/**
 * Vitesse effective en pixels par seconde (spec technique §7.2).
 * @param distance hauteur totale du contenu à faire défiler (px)
 * @param words nombre de mots à prononcer
 */
export function pixelsPerSecond(speed: Speed, distance: number, words: number): number {
  if (speed.unit === 'pxps') return speed.value;
  if (distance <= 0 || words <= 0) return SPEED_LIMITS.pxps.default;
  return (distance * speed.value) / (60 * words);
}

/** Valeur équivalente dans l'autre unité, non arrondie (pour affichage indicatif). */
export function equivalentValue(speed: Speed, distance: number, words: number): number | null {
  if (distance <= 0 || words <= 0) return null;
  return speed.unit === 'wpm'
    ? (distance * speed.value) / (60 * words)
    : (60 * words * speed.value) / distance;
}

/** Conversion lors d'un changement d'unité : même rythme de défilement, arrondi au pas et borné. */
export function convertSpeed(speed: Speed, to: SpeedUnit, distance: number, words: number): Speed {
  if (speed.unit === to) return speed;
  const equivalent = equivalentValue(speed, distance, words);
  return {
    unit: to,
    value: clampSpeed(to, equivalent ?? SPEED_LIMITS[to].default),
  };
}

/** Augmente (+1) ou diminue (−1) la vitesse d'un pas. */
export function stepSpeed(speed: Speed, direction: 1 | -1): Speed {
  const { step } = SPEED_LIMITS[speed.unit];
  return { unit: speed.unit, value: clampSpeed(speed.unit, speed.value + direction * step) };
}

export function speedUnitLabel(unit: SpeedUnit): string {
  return unit === 'wpm' ? 'mots/min' : 'px/s';
}
