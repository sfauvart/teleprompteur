import { SPEED_LIMITS, type PromptSettings } from './settings';
import { estimateDurationSec } from './duration';
import { countWordsMemo } from './words';

export interface Stats {
  wordCount: number;
  estimatedDurationSec: number;
}

/**
 * Statistiques d'un prompt (spec technique §6.3). En px/s, la durée dépend de la mise en page :
 * on utilise la hauteur mesurée si elle est connue, sinon une estimation au débit par défaut.
 */
export function computeStats(
  text: string,
  settings: PromptSettings,
  measuredDistance: number | null = null,
): Stats {
  const wordCount = countWordsMemo(text);
  const estimatedDurationSec =
    settings.speed.unit === 'pxps' && measuredDistance === null
      ? (wordCount * 60) / SPEED_LIMITS.wpm.default
      : estimateDurationSec(settings.speed, measuredDistance ?? 0, wordCount);
  return { wordCount, estimatedDurationSec };
}
