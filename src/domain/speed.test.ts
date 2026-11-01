import { describe, expect, it } from 'vitest';
import { convertSpeed, pixelsPerSecond, stepSpeed } from './speed';
import { estimateDurationSec, formatDuration } from './duration';

describe('pixelsPerSecond', () => {
  it('px/s : valeur directe', () => {
    expect(pixelsPerSecond({ unit: 'pxps', value: 48 }, 5000, 100)).toBe(48);
  });

  it('mots/min : parcourt le texte en mots ÷ débit', () => {
    // 120 mots à 120 mots/min = 60 s pour 6 000 px → 100 px/s
    expect(pixelsPerSecond({ unit: 'wpm', value: 120 }, 6000, 120)).toBe(100);
  });

  it('mots/min sans mots : vitesse par défaut', () => {
    expect(pixelsPerSecond({ unit: 'wpm', value: 120 }, 6000, 0)).toBe(48);
  });
});

describe('convertSpeed', () => {
  it('conserve le rythme de défilement', () => {
    expect(convertSpeed({ unit: 'wpm', value: 120 }, 'pxps', 6000, 120)).toEqual({
      unit: 'pxps',
      value: 100,
    });
    expect(convertSpeed({ unit: 'pxps', value: 100 }, 'wpm', 6000, 120)).toEqual({
      unit: 'wpm',
      value: 120,
    });
  });

  it('borne le résultat', () => {
    expect(convertSpeed({ unit: 'wpm', value: 250 }, 'pxps', 100000, 10).value).toBe(200);
  });

  it('valeur par défaut sans mise en page', () => {
    expect(convertSpeed({ unit: 'wpm', value: 120 }, 'pxps', 0, 0)).toEqual({
      unit: 'pxps',
      value: 48,
    });
  });
});

describe('stepSpeed', () => {
  it('avance d’un pas et reste dans les bornes', () => {
    expect(stepSpeed({ unit: 'wpm', value: 140 }, 1).value).toBe(145);
    expect(stepSpeed({ unit: 'pxps', value: 4 }, -1).value).toBe(4);
  });
});

describe('durée', () => {
  it('estime la durée selon l’unité', () => {
    expect(estimateDurationSec({ unit: 'wpm', value: 140 }, 9999, 280)).toBe(120);
    expect(estimateDurationSec({ unit: 'pxps', value: 50 }, 5000, 280)).toBe(100);
  });

  it('formate MM:SS et HH:MM:SS', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(75.9)).toBe('01:15');
    expect(formatDuration(3725)).toBe('01:02:05');
    expect(formatDuration(-3)).toBe('00:00');
  });
});

describe('durée cible (F44)', () => {
  it('lit les durées saisies', async () => {
    const { parseDuration } = await import('./duration');
    expect(parseDuration('3')).toBe(180);
    expect(parseDuration('2,5')).toBe(150);
    expect(parseDuration('2:30')).toBe(150);
    expect(parseDuration('1:02:00')).toBe(3720);
    expect(parseDuration('2 min 30')).toBe(150);
    expect(parseDuration('90s')).toBe(90);
    expect(parseDuration('n’importe quoi')).toBeNull();
    expect(parseDuration('')).toBeNull();
  });

  it('propose la vitesse correspondante', async () => {
    const { speedForTarget } = await import('./speed');
    expect(speedForTarget('wpm', 120, 0, 300)).toEqual({
      speed: { unit: 'wpm', value: 150 },
      exact: 150,
      clamped: false,
    });
    expect(speedForTarget('pxps', 100, 5000, 0)?.speed).toEqual({ unit: 'pxps', value: 52 });
    expect(speedForTarget('wpm', 10, 0, 300)?.clamped).toBe(true);
    expect(speedForTarget('wpm', 60, 0, 0)).toBeNull();
  });

  it('formate un écart signé', async () => {
    const { formatGap } = await import('./duration');
    expect(formatGap(12)).toBe('+00:12');
    expect(formatGap(-65)).toBe('−01:05');
    expect(formatGap(0)).toBe('±00:00');
  });
});
