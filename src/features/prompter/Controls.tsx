import { useState, useSyncExternalStore } from 'react';
import { formatDuration } from '../../domain/duration';
import {
  FONT_SIZE_LIMITS,
  SPEED_LIMITS,
  clampFontSize,
  clampSpeed,
  type PromptSettings,
  type SpeedUnit,
} from '../../domain/settings';
import { speedUnitLabel } from '../../domain/speed';
import { fr } from '../../i18n/fr';
import type { AudioRecorder } from '../../services/audioRecorder';
import { NumberStepper } from '../../ui/NumberStepper';
import { Switch } from '../../ui/Switch';
import {
  CloseIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  HelpIcon,
  PaletteIcon,
  MicIcon,
  MirrorIcon,
  InvertIcon,
  MoreIcon,
  PauseIcon,
  PlayIcon,
  SpeedIcon,
  StopIcon,
  TextSizeIcon,
} from '../../ui/icons';
import type { EngineState } from './engine/scrollEngine';

interface ControlsProps {
  state: EngineState;
  elapsedSec: number;
  durationSec: number;
  settings: PromptSettings;
  /** Équivalent de la vitesse dans l'autre unité (affichage indicatif), ou null. */
  equivalent: number | null;
  recorder: AudioRecorder;
  fullscreenSupported: boolean;
  isFullscreen: boolean;
  onTogglePlay(): void;
  onStop(): void;
  onFullscreen(): void;
  onSpeed(value: number): void;
  onUnit(unit: SpeedUnit): void;
  onFontSize(value: number): void;
  onSetting(patch: Partial<PromptSettings>): void;
  onHelp(): void;
  onDisplay(): void;
  onClose(): void;
  /** Compte à rebours en cours : le bouton Lecture l'annule. */
  countdown: boolean;
}

/** Barre de contrôles du prompteur (spec fonctionnelle F4) ; menu secondaire sur petit écran. */
export function Controls(props: ControlsProps) {
  const { state, settings, recorder } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const recording = useSyncExternalStore(recorder.subscribe, recorder.isRecording);
  const playing = state === 'playing' || props.countdown;
  const unit = settings.speed.unit;
  const otherUnit: SpeedUnit = unit === 'wpm' ? 'pxps' : 'wpm';

  return (
    <div className="controls" onPointerDown={(e) => e.stopPropagation()}>
      <div className="controls-group">
        <button
          type="button"
          className={`icon-btn ${playing ? 'pause' : 'play'}`}
          onClick={props.onTogglePlay}
          aria-label={playing ? fr.prompter.pause : fr.prompter.play}
          title={`${playing ? fr.prompter.pause : fr.prompter.play} (Espace)`}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className="icon-btn stop"
          onClick={props.onStop}
          aria-label={fr.prompter.stop}
          title={`${fr.prompter.stop} (Début)`}
        >
          <StopIcon />
        </button>
      </div>

      <div className="controls-group">
        <NumberStepper
          label={`${fr.prompter.speed} (${speedUnitLabel(unit)})`}
          icon={<SpeedIcon />}
          value={settings.speed.value}
          step={SPEED_LIMITS[unit].step}
          normalize={(v) => clampSpeed(unit, v)}
          onChange={props.onSpeed}
          suffix={
            <select
              className="unit-select"
              aria-label={fr.prompter.unit}
              value={unit}
              onChange={(e) => props.onUnit(e.target.value as SpeedUnit)}
            >
              <option value="wpm">{fr.prompter.unitWpm}</option>
              <option value="pxps">{fr.prompter.unitPxps}</option>
            </select>
          }
        />
        {props.equivalent !== null && (
          <span className="equivalent" title={fr.a11y.equivalentIn(speedUnitLabel(otherUnit))}>
            {fr.prompter.equivalent(`${Math.round(props.equivalent)} ${speedUnitLabel(otherUnit)}`)}
          </span>
        )}
      </div>

      <div className="controls-group">
        <NumberStepper
          label={fr.prompter.size}
          icon={<TextSizeIcon />}
          value={settings.fontSize}
          step={FONT_SIZE_LIMITS.step}
          normalize={clampFontSize}
          onChange={props.onFontSize}
        />
      </div>

      <div
        className="controls-group time"
        aria-label={`${fr.prompter.elapsed} / ${fr.prompter.duration}`}
      >
        {recording && (
          <span
            className="rec-dot"
            title={fr.prompter.recording}
            aria-label={fr.prompter.recording}
          />
        )}
        <span>{formatDuration(props.elapsedSec)}</span>
        <span aria-hidden="true">/</span>
        <span>{formatDuration(props.durationSec)}</span>
      </div>

      <button
        type="button"
        className="icon-btn more-toggle"
        aria-expanded={menuOpen}
        aria-label={fr.prompter.more}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <MoreIcon />
      </button>

      <div className={`controls-group secondary ${menuOpen ? 'open' : ''}`}>
        {props.fullscreenSupported && (
          <button
            type="button"
            className="icon-btn"
            onClick={props.onFullscreen}
            aria-label={props.isFullscreen ? fr.prompter.exitFullscreen : fr.prompter.fullscreen}
            title={`${props.isFullscreen ? fr.prompter.exitFullscreen : fr.prompter.fullscreen} (F)`}
          >
            {props.isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        )}
        <Switch
          checked={settings.recordAudio}
          onChange={(recordAudio) => props.onSetting({ recordAudio })}
          label={
            <>
              <MicIcon /> {fr.prompter.audio}
            </>
          }
        />
        <Switch
          checked={settings.mirrorX}
          onChange={(mirrorX) => props.onSetting({ mirrorX })}
          title={`${fr.prompter.mirror} (M)`}
          label={
            <>
              <MirrorIcon /> {fr.prompter.mirror}
            </>
          }
        />
        <Switch
          checked={settings.mirrorY}
          onChange={(mirrorY) => props.onSetting({ mirrorY })}
          title={`${fr.prompter.invert} (I)`}
          label={
            <>
              <InvertIcon /> {fr.prompter.invert}
            </>
          }
        />
        <button
          type="button"
          className="icon-btn"
          onClick={props.onDisplay}
          aria-label={fr.display.title}
          title={fr.display.title}
        >
          <PaletteIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={props.onHelp}
          aria-label={fr.prompter.help}
          title={`${fr.prompter.help} (?)`}
        >
          <HelpIcon />
        </button>
      </div>

      <button
        type="button"
        className="icon-btn close"
        onClick={props.onClose}
        aria-label={fr.prompter.close}
        title={`${fr.prompter.close} (Échap)`}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
