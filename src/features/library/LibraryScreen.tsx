import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  copyShareLink,
  exportPrompts,
  importFromFiles,
  newPrompt,
  openPrompt,
} from '../../app/actions';
import { formatDuration } from '../../domain/duration';
import { matchesQuery } from '../../domain/search';
import { fr } from '../../i18n/fr';
import { db } from '../../storage/db';
import { deletePrompt, duplicatePrompt, getPrompt, renamePrompt } from '../../storage/promptsRepo';
import type { Prompt } from '../../storage/types';
import { normalizeSettings } from '../../domain/settings';
import { useSession } from '../../stores/sessionStore';
import { askText, choose, toast } from '../../ui/feedback';
import { MoreIcon, PlayIcon } from '../../ui/icons';

type SortKey = 'updated' | 'used' | 'title' | 'duration';

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

const SORTERS: Record<SortKey, (a: Prompt, b: Prompt) => number> = {
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  used: (a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''),
  title: (a, b) => collator.compare(a.title, b.title),
  duration: (a, b) => a.stats.estimatedDurationSec - b.stats.estimatedDurationSec,
};

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 159)}…` : flat;
}

export function LibraryScreen() {
  const prompts = useLiveQuery(
    async () =>
      (await db.prompts.toArray()).map((p) => ({ ...p, settings: normalizeSettings(p.settings) })),
    [],
  );
  const currentId = useSession((s) => s.draft.promptId);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');

  const visible = useMemo(
    () => (prompts ?? []).filter((p) => matchesQuery(p, query)).sort(SORTERS[sort]),
    [prompts, query, sort],
  );

  return (
    <section className="library-screen">
      <div className="library-header">
        <h1>{fr.library.title}</h1>
        <div className="toolbar">
          <button type="button" className="btn primary" onClick={() => void newPrompt()}>
            {fr.library.newPrompt}
          </button>
          <button type="button" className="btn" onClick={() => void importFromFiles()}>
            {fr.library.import}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!prompts?.length}
            onClick={() => prompts && exportPrompts(prompts, false)}
          >
            {fr.library.exportAll}
          </button>
        </div>
      </div>

      <div className="library-filters">
        <label className="field grow">
          <span className="visually-hidden">{fr.library.search}</span>
          <input
            type="search"
            value={query}
            placeholder={fr.library.searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="field inline">
          <span>{fr.library.sort}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="updated">{fr.library.sortUpdated}</option>
            <option value="used">{fr.library.sortUsed}</option>
            <option value="title">{fr.library.sortTitle}</option>
            <option value="duration">{fr.library.sortDuration}</option>
          </select>
        </label>
      </div>

      {prompts && prompts.length === 0 && (
        <div className="empty">
          <p>{fr.library.empty}</p>
          <p className="hint">{fr.library.emptyHint}</p>
        </div>
      )}
      {prompts && prompts.length > 0 && visible.length === 0 && (
        <p className="empty">{fr.library.noResult}</p>
      )}

      {visible.length > 0 && <p className="hint">{fr.library.count(visible.length)}</p>}
      <ul className="prompt-list">
        {visible.map((prompt) => (
          <PromptCard key={prompt.id} prompt={prompt} current={prompt.id === currentId} />
        ))}
      </ul>
    </section>
  );
}

function PromptCard({ prompt, current }: { prompt: Prompt; current: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const rename = async () => {
    const title = await askText({
      title: fr.library.renameDialog,
      label: fr.save.titleLabel,
      initial: prompt.title,
    });
    if (title === null) return;
    await renamePrompt(prompt.id, title);
    const updated = await getPrompt(prompt.id);
    if (updated) useSession.getState().refreshSaved(updated);
  };

  const duplicate = async () => {
    const title = await askText({
      title: fr.library.duplicateDialog,
      label: fr.save.titleLabel,
      initial: `${prompt.title}${fr.library.copySuffix}`,
    });
    if (title !== null) await duplicatePrompt(prompt.id, title);
  };

  const remove = async () => {
    const choice = await choose({
      title: fr.library.deleteTitle,
      message: fr.library.deleteMessage(prompt.title),
      actions: [
        { value: 'cancel', label: fr.common.cancel },
        { value: 'delete', label: fr.common.delete, variant: 'danger' },
      ],
    });
    if (choice !== 'delete') return;
    await deletePrompt(prompt.id);
    if (useSession.getState().draft.promptId === prompt.id) useSession.getState().detach();
    toast(fr.library.deleted);
  };

  const run = (action: () => unknown) => () => {
    setMenuOpen(false);
    void action();
  };

  return (
    <li className={`prompt-card ${current ? 'current' : ''}`}>
      <div className="prompt-card-body">
        <h2>
          <button type="button" className="link" onClick={() => void openPrompt(prompt, 'editor')}>
            {prompt.title}
          </button>
          {current && <span className="badge">{fr.library.current}</span>}
        </h2>
        <p className="excerpt">{excerpt(prompt.text)}</p>
        <p className="meta">
          {fr.common.words(prompt.stats.wordCount)} ·{' '}
          {formatDuration(prompt.stats.estimatedDurationSec)} ·{' '}
          {fr.library.modifiedOn(dateFormat.format(new Date(prompt.updatedAt)))}
        </p>
      </div>
      <div className="prompt-card-actions">
        <button type="button" className="btn" onClick={() => void openPrompt(prompt, 'editor')}>
          {fr.library.open}
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => void openPrompt(prompt, 'prompter')}
        >
          <PlayIcon width={16} height={16} /> {fr.library.launch}
        </button>
        <div className="menu">
          <button
            type="button"
            className="icon-btn"
            aria-label={`${fr.library.more} : ${prompt.title}`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreIcon />
          </button>
          {menuOpen && (
            <div className="menu-list right" role="menu">
              <button type="button" role="menuitem" onClick={run(rename)}>
                {fr.library.rename}
              </button>
              <button type="button" role="menuitem" onClick={run(duplicate)}>
                {fr.library.duplicate}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={run(() => exportPrompts([prompt], true))}
              >
                {fr.library.exportOne}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={run(() =>
                  copyShareLink({
                    title: prompt.title,
                    text: prompt.text,
                    settings: prompt.settings,
                  }),
                )}
              >
                {fr.library.copyLink}
              </button>
              <button type="button" role="menuitem" className="danger" onClick={run(remove)}>
                {fr.common.delete}
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
