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

describe('réglages d’affichage (F40, F41, F44)', () => {
  it('arrondit l’interligne, la largeur et le compte à rebours au pas', () => {
    const s = normalizeSettings({ lineHeight: 1.43, columnWidth: 72, countdownSec: 2.6 });
    expect(s.lineHeight).toBe(1.4);
    expect(s.columnWidth).toBe(70);
    expect(s.countdownSec).toBe(3);
  });

  it('garde une zone de lecture dans l’écran avec une hauteur minimale', () => {
    expect(
      normalizeSettings({ readingZone: { top: 0.5, bottom: 0.52 } }).readingZone,
    ).toMatchObject({
      top: 0.5,
      bottom: 0.6,
    });
    expect(
      normalizeSettings({ readingZone: { top: 0.95, bottom: 1.4 } }).readingZone,
    ).toMatchObject({
      top: 0.8,
      bottom: 1,
    });
  });

  it('refuse une police inconnue et borne la durée cible', () => {
    const s = normalizeSettings({ font: 'Comic Sans', targetDurationSec: 2 });
    expect(s.font).toBe('system');
    expect(s.targetDurationSec).toBe(10);
    expect(normalizeSettings({ targetDurationSec: null }).targetDurationSec).toBeNull();
  });

  it('complète un thème partiel', () => {
    expect(normalizeSettings({ theme: { text: '#ffe14d' } }).theme).toEqual({
      text: '#ffe14d',
      background: '#000000',
      highlight: '#5c4b00',
      stage: '#6cb6ff',
    });
  });
});
