import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useGesture } from '@use-gesture/react';
import { goBack, navigate } from '../../app/router';
import { saveCurrent } from '../../app/actions';
import { estimateDurationSec } from '../../domain/duration';
import { audioFileName } from '../../domain/filename';
import {
  clampFontSize,
  fontSizePx,
  type PromptSettings,
  type SpeedUnit,
} from '../../domain/settings';
import { convertSpeed, equivalentValue, pixelsPerSecond, stepSpeed } from '../../domain/speed';
import { defaultTitle, hashText } from '../../domain/text';
import { countWordsMemo } from '../../domain/words';
import { fr } from '../../i18n/fr';
import { AudioRecorder, MicrophoneUnavailable, type Recording } from '../../services/audioRecorder';
import { saveFile } from '../../services/fileSaver';
import {
  enterFullscreen,
  exitFullscreen,
  fullscreenElement,
  isFullscreenSupported,
  onFullscreenChange,
} from '../../services/fullscreen';
import { ScreenWakeLock } from '../../services/wakeLock';
import { setLastPosition, touchLastUsed } from '../../storage/promptsRepo';
import { useSession } from '../../stores/sessionStore';
import { choose, toast } from '../../ui/feedback';
import { ScrollEngine, type Layout } from './engine/scrollEngine';
import { Controls } from './Controls';
import { PrompterContent } from './PrompterContent';
import { ShortcutsHelp } from './ShortcutsHelp';
import { useShortcuts } from './useShortcuts';

const BAR_AUTO_HIDE_MS = 3000;

function measureLayout(content: HTMLElement): Layout {
  const blocks = content.querySelectorAll<HTMLElement>('[data-block]');
  const tops: number[] = [];
  const heights: number[] = [];
  blocks.forEach((block) => {
    tops.push(block.offsetTop);
    heights.push(block.offsetHeight);
  });
  return { tops, heights, distance: content.offsetHeight };
}

function micMessage(error: unknown): string {
  if (!(error instanceof MicrophoneUnavailable)) return fr.prompter.micUnknown;
  switch (error.reason) {
    case 'denied':
      return fr.prompter.micDenied;
    case 'not-found':
      return fr.prompter.micNotFound;
    case 'unsupported':
      return fr.prompter.micUnsupported;
    default:
      return fr.prompter.micUnknown;
  }
}

export function PrompterScreen() {
  const draft = useSession((s) => s.draft);
  const saved = useSession((s) => s.saved);
  const updateSettings = useSession((s) => s.updateSettings);
  const setMeasuredDistance = useSession((s) => s.setMeasuredDistance);
  const { settings, text } = draft;

  const [engine] = useState(() => new ScrollEngine());
  const [recorder] = useState(() => new AudioRecorder());
  const [wakeLock] = useState(() => new ScreenWakeLock());
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(() => fullscreenElement() !== null);
  const [barHidden, setBarHidden] = useState(false);
  const [idleHidden, setIdleHidden] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const words = countWordsMemo(text);
  const speedPx = pixelsPerSecond(settings.speed, snapshot.distance, words);
  const durationSec = estimateDurationSec(settings.speed, snapshot.distance, words);
  const equivalent = equivalentValue(settings.speed, snapshot.distance, words);

  // Valeurs courantes pour les gestionnaires d'événements (sans ré-abonnement).
  const latest = useRef({ draft, saved, settings, words, distance: snapshot.distance });
  useEffect(() => {
    latest.current = { draft, saved, settings, words, distance: snapshot.distance };
  });

  // Sans texte (accès direct à #/lecture), retour à l'éditeur.
  useEffect(() => {
    if (!text.trim()) navigate('editor', { replace: true });
  }, [text]);

  useEffect(() => engine.setSpeed(speedPx), [engine, speedPx]);

  // Mesures : surface et contenu suivis par ResizeObserver (spec technique §7.1, §7.6).
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const content = contentRef.current;
    if (!surface || !content) return;
    engine.attach(content);
    const measure = () => {
      engine.setSurfaceHeight(surface.clientHeight);
      const layout = measureLayout(content);
      engine.setLayout(layout);
      setMeasuredDistance(layout.distance);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    observer.observe(content);
    return () => {
      observer.disconnect();
      engine.detach();
    };
  }, [engine, setMeasuredDistance]);

  // --- Position de lecture mémorisée (F25) ---

  const savePosition = () => {
    const { draft: d, saved: s } = latest.current;
    if (!d.promptId || !s) return;
    const anchor = engine.currentAnchor();
    if (!anchor || engine.getPosition() <= 0) return;
    void setLastPosition(d.promptId, { ...anchor, textHash: hashText(d.text) });
  };

  const clearPosition = () => {
    const { draft: d } = latest.current;
    if (d.promptId) void setLastPosition(d.promptId, null);
  };

  // Proposition de reprise à l'ouverture.
  useEffect(() => {
    const { draft: d, saved: s } = latest.current;
    const position = s?.lastPosition;
    if (!s || d.promptId !== s.id || !position || position.textHash !== hashText(d.text)) return;
    if (position.blockIndex === 0 && position.fraction === 0) return;
    let cancelled = false;
    void choose({
      title: fr.prompter.resumeTitle,
      message: fr.prompter.resumeMessage,
      actions: [
        { value: 'restart', label: fr.prompter.restart },
        { value: 'resume', label: fr.prompter.resume, variant: 'primary' },
      ],
    }).then((choice) => {
      if (cancelled) return;
      if (choice === 'resume') engine.seekToAnchor(position);
      else clearPosition();
    });
    return () => {
      cancelled = true;
    };
    // Une seule fois à l'ouverture du prompteur.
  }, [engine]);

  // --- Enregistrement audio (F10) ---

  const deliver = (recording: Recording | null) => {
    if (!recording) return;
    const { draft: d } = latest.current;
    const name = audioFileName(d.title || defaultTitle(d.text), new Date(), recording.extension);
    void saveFile(recording.blob, name);
    toast(fr.prompter.audioSaved(name));
  };

  useEffect(() => {
    if (!settings.recordAudio) {
      void recorder.disable().then(deliver);
      return;
    }
    let cancelled = false;
    recorder
      .enable()
      .then(() => {
        if (!cancelled && engine.getSnapshot().state === 'playing') recorder.startOrResume();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        updateSettings({ recordAudio: false });
        toast(micMessage(error), { tone: 'error', durationMs: 8000 });
      });
    return () => {
      cancelled = true;
    };
  }, [settings.recordAudio, engine, recorder, updateSettings]);

  // --- Effets des changements d'état de lecture (spec technique §7.4) ---

  const previousState = useRef(snapshot.state);
  const usedOnce = useRef(false);
  useEffect(() => {
    const previous = previousState.current;
    const state = snapshot.state;
    previousState.current = state;
    if (previous === state) return;
    if (state === 'playing') {
      void wakeLock.acquire();
      recorder.startOrResume();
      const { draft: d } = latest.current;
      if (!usedOnce.current && d.promptId) {
        usedOnce.current = true;
        void touchLastUsed(d.promptId);
      }
      return;
    }
    void wakeLock.release();
    if (state === 'paused') {
      recorder.pause();
      if (previous === 'playing') savePosition();
    } else {
      void recorder.finish().then(deliver);
      clearPosition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.state]);

  // Fermeture : position mémorisée, micro coupé, plein écran quitté.
  useEffect(
    () => () => {
      const state = engine.getSnapshot().state;
      if (state === 'playing' || state === 'paused') savePosition();
      void recorder.disable().then(deliver);
      wakeLock.dispose();
      void exitFullscreen();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // --- Plein écran ---

  useEffect(() => onFullscreenChange(() => setIsFullscreen(fullscreenElement() !== null)), []);

  const toggleFullscreen = () => {
    if (fullscreenElement()) void exitFullscreen();
    else void enterFullscreen(document.documentElement).catch(() => undefined);
  };

  // --- Masquage automatique de la barre (F33) ---

  useEffect(() => {
    if (snapshot.state !== 'playing') return;
    let timer = setTimeout(() => setIdleHidden(true), BAR_AUTO_HIDE_MS);
    const onMove = () => {
      setIdleHidden(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdleHidden(true), BAR_AUTO_HIDE_MS);
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', onMove);
    };
  }, [snapshot.state]);

  // --- Commandes ---

  const close = () => goBack('editor');

  const setFontSize = (fontSize: number) => {
    if (fontSize !== latest.current.settings.fontSize) updateSettings({ fontSize });
  };

  const setUnit = (unit: SpeedUnit) => {
    const { settings: s, distance, words: w } = latest.current;
    updateSettings({ speed: convertSpeed(s.speed, unit, distance, w) });
  };

  const isParagraph = (index: number) =>
    contentRef.current?.querySelector(`[data-block="${index}"]`)?.hasAttribute('data-paragraph') ??
    false;

  useShortcuts({
    togglePlay: () => engine.toggle(),
    escape: () => {
      if (showHelp) setShowHelp(false);
      else if (fullscreenElement()) void exitFullscreen();
      else close();
    },
    speed: (direction) =>
      updateSettings({ speed: stepSpeed(latest.current.settings.speed, direction) }),
    size: (direction) => setFontSize(clampFontSize(latest.current.settings.fontSize + direction)),
    page: (direction) => engine.page(direction),
    paragraph: (direction) => engine.jumpBlock(direction, isParagraph),
    stop: () => engine.stop(),
    fullscreen: () => isFullscreenSupported() && toggleFullscreen(),
    mirror: () => updateSettings({ mirrorX: !latest.current.settings.mirrorX }),
    invert: () => updateSettings({ mirrorY: !latest.current.settings.mirrorY }),
    toggleBar: () => setBarHidden((hidden) => !hidden),
    help: () => setShowHelp((open) => !open),
    save: () => void saveCurrent(),
  });

  // --- Gestes (F31) : glisser, toucher, molette, pincement ---

  useGesture(
    {
      onDrag: ({ tap, delta: [, dy], pinching, cancel }) => {
        if (pinching) return cancel();
        if (tap) engine.toggle();
        else engine.nudge(-dy);
      },
      onWheel: ({ delta: [, dy], pinching }) => {
        if (!pinching) engine.nudge(dy);
      },
      onPinch: ({ first, movement: [scale], memo }) => {
        const base: number = first || memo === undefined ? latest.current.settings.fontSize : memo;
        setFontSize(clampFontSize(Math.round(base * scale)));
        return base;
      },
    },
    {
      target: surfaceRef,
      eventOptions: { passive: false },
      drag: { filterTaps: true },
    },
  );

  const transform = `scale(${settings.mirrorX ? -1 : 1}, ${settings.mirrorY ? -1 : 1})`;
  // Masquage automatique uniquement pendant la lecture.
  const barVisible = !barHidden && !(idleHidden && snapshot.state === 'playing');
  const zone = settings.readingZone;

  const contentStyle = useMemo(
    () => ({
      fontSize: `${fontSizePx(settings.fontSize)}px`,
      ['--line-height' as string]: String(settings.lineHeight),
      color: settings.theme.text,
    }),
    [settings.fontSize, settings.lineHeight, settings.theme.text],
  );

  return (
    <div
      className={`prompter ${barVisible ? '' : 'bar-hidden'}`}
      style={{ background: settings.theme.background }}
    >
      <div ref={surfaceRef} className="prompter-surface">
        <div className="prompter-stage" style={{ transform }}>
          <div ref={contentRef} className="prompter-text prompter-scroll" style={contentStyle}>
            <PrompterContent text={text} lineHeight={settings.lineHeight} />
          </div>
        </div>
        <div
          className="reading-zone"
          aria-hidden="true"
          style={{
            top: `${zone.top * 100}%`,
            height: `${(zone.bottom - zone.top) * 100}%`,
            background: `rgba(255, 255, 255, ${zone.opacity})`,
          }}
        />
        {snapshot.state === 'ended' && <div className="end-badge">{fr.prompter.end}</div>}
      </div>

      {barVisible && (
        <Controls
          state={snapshot.state}
          elapsedSec={snapshot.elapsedSec}
          durationSec={durationSec}
          settings={settings}
          equivalent={equivalent}
          recorder={recorder}
          fullscreenSupported={isFullscreenSupported()}
          isFullscreen={isFullscreen}
          onTogglePlay={() => engine.toggle()}
          onStop={() => engine.stop()}
          onFullscreen={toggleFullscreen}
          onSpeed={(value) => updateSettings({ speed: { unit: settings.speed.unit, value } })}
          onUnit={setUnit}
          onFontSize={setFontSize}
          onSetting={(patch: Partial<PromptSettings>) => updateSettings(patch)}
          onHelp={() => setShowHelp(true)}
          onClose={close}
        />
      )}

      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
