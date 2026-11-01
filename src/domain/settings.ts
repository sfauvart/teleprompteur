import { z } from './zod';

export type SpeedUnit = 'wpm' | 'pxps';

export const SPEED_LIMITS = {
  wpm: { min: 60, max: 250, step: 5, default: 140 },
  pxps: { min: 4, max: 200, step: 4, default: 48 },
} as const satisfies Record<SpeedUnit, { min: number; max: number; step: number; default: number }>;

export const FONT_SIZE_LIMITS = { min: 1, max: 20, step: 1, default: 10 } as const;

/**
 * Taille relative à la largeur de la colonne de texte (F6) : la police vaut
 * `réglage / 147,2` de la largeur utile. Un même réglage donne le même nombre de caractères
 * par ligne sur tous les écrans ; sur un écran de 1 280 px, le réglage 10 donne 80 px.
 */
export const FONT_SIZE_WIDTH_DIVISOR = 147.2;

export const COUNTDOWN_LIMITS = { min: 0, max: 10, step: 1, default: 3 } as const;

export const LINE_HEIGHT_LIMITS = { min: 1, max: 2.5, step: 0.1, default: 1.4 } as const;

/** Largeur de la colonne de texte, en % de la largeur disponible (max. 1 320 px). */
export const COLUMN_WIDTH_LIMITS = { min: 30, max: 100, step: 5, default: 100 } as const;

/** Zone de lecture : fractions de la hauteur d'écran. */
export const READING_ZONE_LIMITS = {
  top: { min: 0.05, max: 0.8, step: 0.01, default: 0.32 },
  height: { min: 0.1, max: 0.6, step: 0.01, default: 0.38 },
  opacity: { min: 0, max: 0.4, step: 0.02, default: 0.08 },
} as const;

/** Durée cible (F44), en secondes. */
export const TARGET_DURATION_LIMITS = { min: 10, max: 4 * 3600 } as const;

/** Polices disponibles hors ligne (polices système uniquement). */
export const FONTS = {
  system: { label: 'Système', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  humanist: { label: 'Lisible', stack: "Verdana, 'DejaVu Sans', Tahoma, sans-serif" },
  serif: { label: 'Serif', stack: "Georgia, 'Times New Roman', serif" },
  mono: { label: 'Chasse fixe', stack: "ui-monospace, 'DejaVu Sans Mono', Menlo, monospace" },
} as const;

export type FontKey = keyof typeof FONTS;

/** Thèmes prédéfinis (F41). */
export const THEME_PRESETS = {
  classic: {
    label: 'Blanc sur noir',
    text: '#ffffff',
    background: '#000000',
    highlight: '#5c4b00',
  },
  yellow: { label: 'Jaune sur noir', text: '#ffe14d', background: '#000000', highlight: '#2f4a8a' },
  inverse: {
    label: 'Noir sur blanc',
    text: '#000000',
    background: '#ffffff',
    highlight: '#ffe58a',
  },
} as const;

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

function steppedNumber(limits: { min: number; max: number; step: number; default: number }) {
  return finite.catch(limits.default).transform((v) => roundTo(snap(v, limits), 2));
}

/** Arrondi au pas et bornage, avec 2 décimales au plus (pas décimaux). */
export function snapValue(
  value: number,
  limits: { min: number; max: number; step: number },
): number {
  return roundTo(snap(value, limits), 2);
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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
    stage: colorSchema('#6cb6ff'),
  }),
);

const readingZoneSchema = z.preprocess(
  objectOrEmpty,
  z
    .object({
      top: finite.catch(READING_ZONE_LIMITS.top.default),
      bottom: finite.catch(READING_ZONE_LIMITS.top.default + READING_ZONE_LIMITS.height.default),
      opacity: steppedNumber(READING_ZONE_LIMITS.opacity),
    })
    .transform(({ top, bottom, opacity }) => {
      // La zone reste dans l'écran avec une hauteur minimale.
      const t = roundTo(snap(top, READING_ZONE_LIMITS.top), 2);
      const height = roundTo(clamp(bottom - t, READING_ZONE_LIMITS.height.min, 1 - t), 2);
      return { top: t, bottom: roundTo(t + height, 2), opacity };
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
    countdownSec: steppedNumber(COUNTDOWN_LIMITS),
    theme: themeSchema,
    lineHeight: steppedNumber(LINE_HEIGHT_LIMITS),
    columnWidth: steppedNumber(COLUMN_WIDTH_LIMITS),
    align: z.enum(['left', 'center']).catch('left'),
    readingZone: readingZoneSchema,
    font: z.enum(Object.keys(FONTS) as [FontKey, ...FontKey[]]).catch('system'),
    targetDurationSec: finite
      .transform((v) =>
        Math.round(clamp(v, TARGET_DURATION_LIMITS.min, TARGET_DURATION_LIMITS.max)),
      )
      .nullable()
      .catch(null),
  }),
);

export type PromptSettings = z.output<typeof settingsSchema>;

export function normalizeSettings(input: unknown): PromptSettings {
  return settingsSchema.parse(input);
}

export const DEFAULT_SETTINGS: PromptSettings = normalizeSettings({});

/** Fraction de la largeur utile de la colonne occupée par la taille de police. */
export function fontScale(fontSize: number): number {
  return fontSize / FONT_SIZE_WIDTH_DIVISOR;
}

/** Le texte démarre juste sous le haut de la zone de lecture (32 % → 35 % par défaut). */
export function textStartRatio(zone: PromptSettings['readingZone']): number {
  return Math.min(zone.top + 0.03, zone.bottom);
}
