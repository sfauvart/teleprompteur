import { useEffect, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  FONT_SIZE_LIMITS,
  SPEED_LIMITS,
  clampFontSize,
  clampSpeed,
  type PromptSettings,
  type SpeedUnit,
} from '../../domain/settings';
import { fr } from '../../i18n/fr';
import { useSession } from '../../stores/sessionStore';
import { toast } from '../../ui/feedback';
import { NumberStepper } from '../../ui/NumberStepper';
import { Switch } from '../../ui/Switch';
import { SpeedIcon, TextSizeIcon } from '../../ui/icons';
import { DisplaySettingsForm } from '../display/DisplaySettingsForm';
import { DriveSettings } from '../drive/DriveSettings';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

/** Safari iOS hors application installée (spec technique §5.4). */
function isIosSafariBrowser(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return 'standalone' in nav && nav.standalone === false;
}

function useStorageInfo() {
  const [info, setInfo] = useState<{ persisted: boolean; usage: number | null } | null>(null);
  useEffect(() => {
    if (!navigator.storage?.persisted) return;
    void Promise.all([navigator.storage.persisted(), navigator.storage.estimate?.()]).then(
      ([persisted, estimate]) => setInfo({ persisted, usage: estimate?.usage ?? null }),
    );
  }, []);
  return info;
}

export function PreferencesScreen() {
  const preferences = useSession((s) => s.preferences);
  const setPreferences = useSession((s) => s.setPreferences);
  const draft = useSession((s) => s.draft);
  const updateSettings = useSession((s) => s.updateSettings);
  const storage = useStorageInfo();
  const settings = preferences.defaultSettings;

  const update = (patch: Partial<PromptSettings>) =>
    void setPreferences({ ...preferences, defaultSettings: { ...settings, ...patch } });

  const setUnit = (unit: SpeedUnit) =>
    update({
      speed: {
        unit,
        value: unit === settings.speed.unit ? settings.speed.value : SPEED_LIMITS[unit].default,
      },
    });

  return (
    <section className="preferences-screen">
      <h1>{fr.preferences.title}</h1>

      <fieldset className="panel">
        <legend>{fr.preferences.defaults}</legend>
        <p className="hint">{fr.preferences.defaultsHint}</p>

        <div className="pref-row">
          <span>{fr.prompter.unit}</span>
          <div className="segmented" role="radiogroup" aria-label={fr.prompter.unit}>
            {(['wpm', 'pxps'] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                role="radio"
                aria-checked={settings.speed.unit === unit}
                className={settings.speed.unit === unit ? 'active' : ''}
                onClick={() => setUnit(unit)}
              >
                {unit === 'wpm' ? fr.prompter.unitWpm : fr.prompter.unitPxps}
              </button>
            ))}
          </div>
        </div>

        <div className="pref-row">
          <span>{fr.prompter.speed}</span>
          <NumberStepper
            label={fr.prompter.speed}
            icon={<SpeedIcon />}
            value={settings.speed.value}
            step={SPEED_LIMITS[settings.speed.unit].step}
            normalize={(v) => clampSpeed(settings.speed.unit, v)}
            onChange={(value) => update({ speed: { unit: settings.speed.unit, value } })}
            suffix={settings.speed.unit === 'wpm' ? fr.prompter.unitWpm : fr.prompter.unitPxps}
          />
        </div>

        <div className="pref-row">
          <span>{fr.prompter.size}</span>
          <NumberStepper
            label={fr.prompter.size}
            icon={<TextSizeIcon />}
            value={settings.fontSize}
            step={FONT_SIZE_LIMITS.step}
            normalize={clampFontSize}
            onChange={(fontSize) => update({ fontSize })}
          />
        </div>

        <div className="pref-switches">
          <Switch
            checked={settings.mirrorX}
            onChange={(mirrorX) => update({ mirrorX })}
            label={fr.prompter.mirror}
          />
          <Switch
            checked={settings.mirrorY}
            onChange={(mirrorY) => update({ mirrorY })}
            label={fr.prompter.invert}
          />
          <Switch
            checked={settings.recordAudio}
            onChange={(recordAudio) => update({ recordAudio })}
            label={fr.prompter.audio}
          />
        </div>

        <div className="toolbar">
          <button type="button" className="btn" onClick={() => update(DEFAULT_SETTINGS)}>
            {fr.preferences.reset}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              void setPreferences({ ...preferences, defaultSettings: draft.settings });
              toast(fr.preferences.saved);
            }}
          >
            {fr.preferences.useCurrent}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              updateSettings(settings);
              toast(fr.preferences.currentUpdated);
            }}
          >
            {fr.preferences.resetCurrent}
          </button>
        </div>
      </fieldset>

      <fieldset className="panel">
        <legend>{fr.display.title}</legend>
        <DisplaySettingsForm settings={settings} onChange={update} />
      </fieldset>

      <DriveSettings />

      <section className="panel">
        <h2>{fr.preferences.storage}</h2>
        <p>{fr.preferences.storageInfo}</p>
        {storage && (
          <p className="hint">
            {storage.persisted
              ? fr.preferences.storagePersisted
              : fr.preferences.storageNotPersisted}
            {storage.usage !== null && (
              <> · {fr.preferences.storageUsage(formatBytes(storage.usage))}</>
            )}
          </p>
        )}
      </section>

      {isIosSafariBrowser() && (
        <section className="panel">
          <h2>{fr.preferences.installTitle}</h2>
          <p>{fr.preferences.installIos}</p>
        </section>
      )}

      <p className="hint">
        <a href={`${import.meta.env.BASE_URL}confidentialite.html`}>{fr.preferences.privacy}</a> ·{' '}
        {fr.preferences.version(__APP_VERSION__)}
      </p>
    </section>
  );
}
