import { z } from './zod';

export type SpeedUnit = 'wpm' | 'pxps';

export const SPEED_LIMITS = {
  wpm: { min: 60, max: 250, step: 5, default: 140 },
  pxps: { min: 4, max: 200, step: 4, default: 48 },
} as const satisfies Record<SpeedUnit, { min: number; max: number; step: number; default: number }>;

export const FONT_SIZE_LIMITS = { min: 1, max: 20, step: 1, default: 10 } as const;

/** Taille de police en pixels = réglage × 8 (spec fonctionnelle F6). */
export const FONT_SIZE_PX_FACTOR = 8;

export const COUNTDOWN_LIMITS = { min: 0, max: 10, default: 3 } as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Arrondit au pas puis ramène dans la plage. */
export function snap(value: number, limits: { min: number; max: number; step: number }): number {
  const rounded = Math.round(value / limits.step) * limits.step;
  return clamp(rounded, limits.min, limits.max);
}

export function clampSpeed(unit: SpeedUnit, value: number): number {
  return snap(value, SPEED_LIMITS[unit]);
}

export function clampFontSize(value: number): number {
  return snap(value, FONT_SIZE_LIMITS);
}

const finite = z.number().refine(Number.isFinite);

function boundedNumber(min: number, max: number, fallback: number) {
  return finite.catch(fallback).transform((v) => clamp(v, min, max));
}

const speedSchema = z
  .object({
    unit: z.enum(['wpm', 'pxps']).catch('wpm'),
    value: finite.optional().catch(undefined),
  })
  .catch({ unit: 'wpm', value: undefined })
  .transform(({ unit, value }) => ({
    unit,
    value: clampSpeed(unit, value ?? SPEED_LIMITS[unit].default),
  }));

const colorSchema = (fallback: string) =>
  z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .catch(fallback);

const objectOrEmpty = (v: unknown) => (typeof v === 'object' && v !== null ? v : {});

const themeSchema = z.preprocess(
  objectOrEmpty,
  z.object({
    text: colorSchema('#ffffff'),
    background: colorSchema('#000000'),
    highlight: colorSchema('#5c4b00'),
  }),
);

const readingZoneSchema = z.preprocess(
  objectOrEmpty,
  z.object({
    top: boundedNumber(0, 0.9, 0.32),
    bottom: boundedNumber(0.1, 1, 0.7),
    opacity: boundedNumber(0, 0.5, 0.08),
  }),
);

/**
 * Schéma unique des réglages d'un prompt (spec technique §5.2).
 * Toute donnée lue (base, import, lien) passe par ce schéma : champ manquant → valeur par défaut,
 * valeur hors bornes → ramenée à la borne. Les champs P2 sont présents dès la v1.
 */
export const settingsSchema = z.preprocess(
  objectOrEmpty,
  z.object({
    speed: speedSchema,
    fontSize: finite.catch(FONT_SIZE_LIMITS.default).transform(clampFontSize),
    mirrorX: z.boolean().catch(false),
    mirrorY: z.boolean().catch(false),
    recordAudio: z.boolean().catch(false),
    // P2 (F40, F41, F44)
    countdownSec: boundedNumber(
      COUNTDOWN_LIMITS.min,
      COUNTDOWN_LIMITS.max,
      COUNTDOWN_LIMITS.default,
    ),
    theme: themeSchema,
    lineHeight: boundedNumber(1, 2.5, 1.4),
    columnWidth: boundedNumber(20, 100, 100),
    align: z.enum(['left', 'center']).catch('left'),
    readingZone: readingZoneSchema,
    font: z.string().max(100).catch('system'),
    targetDurationSec: finite.positive().nullable().catch(null),
  }),
);

export type PromptSettings = z.output<typeof settingsSchema>;

export function normalizeSettings(input: unknown): PromptSettings {
  return settingsSchema.parse(input);
}

export const DEFAULT_SETTINGS: PromptSettings = normalizeSettings({});

export function fontSizePx(fontSize: number): number {
  return fontSize * FONT_SIZE_PX_FACTOR;
}
