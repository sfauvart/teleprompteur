import { useEffect, useRef, useState } from 'react';
import type { EditorView } from '@codemirror/view';
import {
  copyShareLink,
  exportCurrent,
  importFromFiles,
  newPrompt,
  saveCurrent,
  saveCurrentAs,
} from '../../app/actions';
import { navigate } from '../../app/router';
import { formatDuration } from '../../domain/duration';
import type { PromptSettings } from '../../domain/settings';
import { speedUnitLabel } from '../../domain/speed';
import { computeStats } from '../../domain/stats';
import { defaultTitle } from '../../domain/text';
import { fr } from '../../i18n/fr';
import { isDirty, useSession } from '../../stores/sessionStore';
import { LinkIcon, PlayIcon } from '../../ui/icons';
import { measureDistance, type TextDisplay } from '../prompter/PrompterContent';
import { TargetDuration } from './TargetDuration';
import { DriveBadge } from '../drive/DriveBadge';
import { DriveMenu } from '../drive/DriveMenu';
import { CodeEditor } from './CodeEditor';
import { MarkdownToolbar } from './MarkdownToolbar';

const MEASURE_DEBOUNCE_MS = 300;

/** Hauteur du texte dans le prompteur, mesurée en différé (durée estimée en px/s). */
function useMeasuredDistance(text: string, settings: PromptSettings): void {
  const { fontSize, lineHeight, columnWidth, font, align, theme } = settings;
  const setMeasuredDistance = useSession((s) => s.setMeasuredDistance);
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const display: TextDisplay = { fontSize, lineHeight, columnWidth, font, align, theme };
    const timer = setTimeout(
      () => setMeasuredDistance(measureDistance(text, display)),
      MEASURE_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [text, fontSize, lineHeight, columnWidth, font, align, theme, width, setMeasuredDistance]);
}

export function EditorScreen() {
  const draft = useSession((s) => s.draft);
  const saved = useSession((s) => s.saved);
  const measuredDistance = useSession((s) => s.measuredDistance);
  const setText = useSession((s) => s.setText);
  const setTitle = useSession((s) => s.setTitle);
  const [error, setError] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const editorView = useRef<EditorView | null>(null);

  useMeasuredDistance(draft.text, draft.settings);

  const dirty = isDirty(draft, saved);
  const stats = computeStats(draft.text, draft.settings, measuredDistance);
  const { speed } = draft.settings;

  const launch = () => {
    if (!useSession.getState().draft.text.trim()) {
      setError(true);
      return;
    }
    setError(false);
    navigate('prompter');
  };

  return (
    <section className="editor-screen">
      <div className="editor-header">
        <label className="title-field">
          <span className="visually-hidden">{fr.editor.titleLabel}</span>
          <input
            value={draft.title}
            placeholder={defaultTitle(draft.text) || fr.editor.titlePlaceholder}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <DriveBadge prompt={draft} />
        {dirty && (
          <span className="badge" title={draft.promptId ? undefined : fr.editor.unsaved}>
            {draft.promptId ? fr.editor.modified : fr.editor.unsaved}
          </span>
        )}
      </div>

      <div className="toolbar" role="toolbar" aria-label={fr.a11y.actions}>
        <button type="button" className="btn" onClick={() => void newPrompt()}>
          {fr.editor.newPrompt}
        </button>
        <button type="button" className="btn" onClick={() => void saveCurrent()} title="Ctrl+S">
          {fr.editor.save}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => void saveCurrentAs()}
          disabled={!draft.text.trim()}
        >
          {fr.editor.saveAs}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!draft.text.trim()}
          onClick={() =>
            void copyShareLink({
              title: draft.title || defaultTitle(draft.text),
              text: draft.text,
              settings: draft.settings,
            })
          }
        >
          <LinkIcon width={16} height={16} /> {fr.editor.copyLink}
        </button>
        <button type="button" className="btn" onClick={() => void importFromFiles()}>
          {fr.editor.import}
        </button>
        <div className="menu">
          <button
            type="button"
            className="btn"
            aria-expanded={exportOpen}
            aria-haspopup="menu"
            disabled={!draft.text.trim()}
            onClick={() => setExportOpen((open) => !open)}
          >
            {fr.editor.export} ▾
          </button>
          {exportOpen && (
            <div className="menu-list" role="menu" onClick={() => setExportOpen(false)}>
              <button type="button" role="menuitem" onClick={() => exportCurrent('json')}>
                {fr.editor.exportJson}
              </button>
              <button type="button" role="menuitem" onClick={() => exportCurrent('md')}>
                {fr.editor.exportMd}
              </button>
              <button type="button" role="menuitem" onClick={() => exportCurrent('txt')}>
                {fr.editor.exportTxt}
              </button>
            </div>
          )}
        </div>
        <DriveMenu />
      </div>

      <MarkdownToolbar view={editorView} />
      <CodeEditor
        onView={(view) => {
          editorView.current = view;
        }}
        value={draft.text}
        onChange={(text) => {
          setText(text);
          if (text.trim()) setError(false);
        }}
        placeholder={fr.editor.placeholder}
        ariaLabel={fr.editor.placeholder}
        onLaunch={launch}
        onSave={() => void saveCurrent()}
      />

      <p className="editor-stats" aria-live="polite">
        {fr.editor.estimate(
          fr.common.words(stats.wordCount),
          formatDuration(stats.estimatedDurationSec),
          `${speed.value} ${speedUnitLabel(speed.unit)}`,
        )}
      </p>
      <TargetDuration />

      <div className="launch">
        <button type="button" className="btn primary large" onClick={launch}>
          <PlayIcon /> {fr.editor.prompt}
        </button>
        {error && (
          <p className="error" role="alert">
            {fr.editor.emptyError}
          </p>
        )}
        <p className="hint">{fr.editor.shortcutHint}</p>
      </div>
    </section>
  );
}
