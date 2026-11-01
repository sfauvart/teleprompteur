import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, clampSpeed, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('applique les valeurs par défaut', () => {
    expect(DEFAULT_SETTINGS.speed).toEqual({ unit: 'wpm', value: 140 });
    expect(DEFAULT_SETTINGS.fontSize).toBe(10);
    expect(DEFAULT_SETTINGS.mirrorX).toBe(false);
    expect(DEFAULT_SETTINGS.countdownSec).toBe(3);
    expect(DEFAULT_SETTINGS.readingZone).toEqual({ top: 0.32, bottom: 0.7, opacity: 0.08 });
  });

  it('accepte une entrée non objet', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('n importe quoi')).toEqual(DEFAULT_SETTINGS);
  });

  it('ramène les valeurs hors bornes', () => {
    const s = normalizeSettings({ speed: { unit: 'pxps', value: 999 }, fontSize: 0 });
    expect(s.speed).toEqual({ unit: 'pxps', value: 200 });
    expect(s.fontSize).toBe(1);
  });

  it('remplace les valeurs invalides', () => {
    const s = normalizeSettings({ speed: { unit: 'kmh', value: 'vite' }, mirrorX: 'oui' });
    expect(s.speed).toEqual({ unit: 'wpm', value: 140 });
    expect(s.mirrorX).toBe(false);
  });

  it('donne la valeur par défaut de l’unité quand la vitesse manque', () => {
    expect(normalizeSettings({ speed: { unit: 'pxps' } }).speed).toEqual({
      unit: 'pxps',
      value: 48,
    });
  });

  it('ignore les champs inconnus', () => {
    expect(normalizeSettings({ inconnu: 1 })).not.toHaveProperty('inconnu');
  });
});

describe('clampSpeed', () => {
  it('arrondit au pas', () => {
    expect(clampSpeed('wpm', 142)).toBe(140);
    expect(clampSpeed('wpm', 143)).toBe(145);
    expect(clampSpeed('pxps', 50)).toBe(52);
    expect(clampSpeed('wpm', 10)).toBe(60);
  });
});
