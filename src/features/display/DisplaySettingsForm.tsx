import {
  COLUMN_WIDTH_LIMITS,
  COUNTDOWN_LIMITS,
  FONTS,
  LINE_HEIGHT_LIMITS,
  READING_ZONE_LIMITS,
  THEME_PRESETS,
  clamp,
  snapValue,
  type FontKey,
  type PromptSettings,
} from '../../domain/settings';
import { fr } from '../../i18n/fr';
import { NumberStepper } from '../../ui/NumberStepper';

interface DisplaySettingsFormProps {
  settings: PromptSettings;
  onChange(patch: Partial<PromptSettings>): void;
}

/** Les réglages de zone sont saisis en pourcentages entiers. */
const percent = (limits: { min: number; max: number; step: number }) => ({
  min: Math.round(limits.min * 100),
  max: Math.round(limits.max * 100),
  step: Math.max(1, Math.round(limits.step * 100)),
});

/**
 * Réglages d'affichage et de lecture (F40, F41), partagés par le prompteur
 * et les préférences.
 */
export function DisplaySettingsForm({ settings, onChange }: DisplaySettingsFormProps) {
  const { theme, readingZone: zone } = settings;
  const zoneTop = Math.round(zone.top * 100);
  const zoneHeight = Math.round((zone.bottom - zone.top) * 100);
  const topLimits = percent(READING_ZONE_LIMITS.top);
  const heightLimits = percent(READING_ZONE_LIMITS.height);
  const opacityLimits = percent(READING_ZONE_LIMITS.opacity);

  const setZone = (top: number, height: number, opacity = zone.opacity) =>
    onChange({ readingZone: { top: top / 100, bottom: (top + height) / 100, opacity } });

  return (
    <div className="display-form">
      <div className="pref-row">
        <span>{fr.display.theme}</span>
        <div className="segmented wrap" role="radiogroup" aria-label={fr.display.theme}>
          {Object.entries(THEME_PRESETS).map(([key, preset]) => {
            const active = theme.text === preset.text && theme.background === preset.background;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                className={active ? 'active' : ''}
                onClick={() =>
                  onChange({
                    theme: { ...theme, text: preset.text, background: preset.background },
                  })
                }
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pref-row">
        <span>{fr.display.colors}</span>
        <div className="colors">
          {(
            [
              ['text', fr.display.textColor],
              ['background', fr.display.backgroundColor],
              ['stage', fr.display.stageColor],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="color-field">
              <input
                type="color"
                value={theme[key]}
                onChange={(e) => onChange({ theme: { ...theme, [key]: e.target.value } })}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="pref-row">
        <label htmlFor="display-font">{fr.display.font}</label>
        <select
          id="display-font"
          value={settings.font}
          onChange={(e) => onChange({ font: e.target.value as FontKey })}
        >
          {Object.entries(FONTS).map(([key, font]) => (
            <option key={key} value={key}>
              {font.label}
            </option>
          ))}
        </select>
      </div>

      <div className="pref-row">
        <span>{fr.display.lineHeight}</span>
        <NumberStepper
          label={fr.display.lineHeight}
          value={settings.lineHeight}
          step={LINE_HEIGHT_LIMITS.step}
          normalize={(v) => snapValue(v, LINE_HEIGHT_LIMITS)}
          onChange={(lineHeight) => onChange({ lineHeight })}
        />
      </div>

      <div className="pref-row">
        <span>{fr.display.columnWidth}</span>
        <NumberStepper
          label={fr.display.columnWidth}
          value={settings.columnWidth}
          step={COLUMN_WIDTH_LIMITS.step}
          normalize={(v) => snapValue(v, COLUMN_WIDTH_LIMITS)}
          onChange={(columnWidth) => onChange({ columnWidth })}
          suffix={fr.display.percent}
        />
      </div>

      <div className="pref-row">
        <span>{fr.display.align}</span>
        <div className="segmented" role="radiogroup" aria-label={fr.display.align}>
          {(
            [
              ['left', fr.display.alignLeft],
              ['center', fr.display.alignCenter],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={settings.align === value}
              className={settings.align === value ? 'active' : ''}
              onClick={() => onChange({ align: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="pref-row">
        <span>{fr.display.zoneTop}</span>
        <NumberStepper
          label={fr.display.zoneTop}
          value={zoneTop}
          step={topLimits.step}
          normalize={(v) => clamp(Math.round(v), topLimits.min, topLimits.max)}
          onChange={(top) => setZone(top, Math.min(zoneHeight, 100 - top))}
          suffix={fr.display.percent}
        />
      </div>

      <div className="pref-row">
        <span>{fr.display.zoneHeight}</span>
        <NumberStepper
          label={fr.display.zoneHeight}
          value={zoneHeight}
          step={heightLimits.step}
          normalize={(v) =>
            clamp(Math.round(v), heightLimits.min, Math.min(heightLimits.max, 100 - zoneTop))
          }
          onChange={(height) => setZone(zoneTop, height)}
          suffix={fr.display.percent}
        />
      </div>

      <div className="pref-row">
        <span>{fr.display.zoneOpacity}</span>
        <NumberStepper
          label={fr.display.zoneOpacity}
          value={Math.round(zone.opacity * 100)}
          step={opacityLimits.step}
          normalize={(v) =>
            clamp(
              Math.round(v / opacityLimits.step) * opacityLimits.step,
              opacityLimits.min,
              opacityLimits.max,
            )
          }
          onChange={(opacity) => setZone(zoneTop, zoneHeight, opacity / 100)}
          suffix={fr.display.percent}
        />
      </div>

      <div className="pref-row">
        <span>{fr.display.countdown}</span>
        <NumberStepper
          label={fr.display.countdown}
          value={settings.countdownSec}
          step={COUNTDOWN_LIMITS.step}
          normalize={(v) => snapValue(v, COUNTDOWN_LIMITS)}
          onChange={(countdownSec) => onChange({ countdownSec })}
          suffix={fr.display.seconds}
        />
      </div>
    </div>
  );
}
