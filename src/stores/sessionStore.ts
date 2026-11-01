import { create } from 'zustand';
import type { PromptSettings } from '../domain/settings';
import type { SharedPrompt } from '../domain/sharedPrompt';
import { computeStats } from '../domain/stats';
import { defaultTitle } from '../domain/text';
import { requestPersistentStorage } from '../storage/db';
import { loadDraft, saveDraft } from '../storage/draftRepo';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from '../storage/preferencesRepo';
import { createPrompt, getPrompt, updatePrompt } from '../storage/promptsRepo';
import type { Draft, DriveLink, Preferences, Prompt } from '../storage/types';

export type SaveResult =
  { status: 'saved'; prompt: Prompt } | { status: 'needs-title' } | { status: 'conflict' };

interface SessionState {
  ready: boolean;
  draft: Draft;
  /** Version enregistrée de référence (null si le brouillon n'a jamais été enregistré). */
  saved: Prompt | null;
  preferences: Preferences;
  /** Hauteur du texte mesurée pour l'affichage courant (px), utile en mode px/s. */
  measuredDistance: number | null;

  init(): Promise<void>;
  setText(text: string): void;
  setTitle(title: string): void;
  updateSettings(patch: Partial<PromptSettings>): void;
  setMeasuredDistance(distance: number | null): void;
  newPrompt(): void;
  openPrompt(prompt: Prompt): void;
  loadShared(shared: SharedPrompt, drive?: DriveLink | null): void;
  save(options?: { title?: string; force?: boolean }): Promise<SaveResult>;
  saveAs(title: string): Promise<Prompt>;
  /** Le prompt courant a été supprimé : le brouillon devient non enregistré. */
  detach(): void;
  /** Le prompt courant a été modifié ailleurs (renommage depuis la bibliothèque…). */
  refreshSaved(prompt: Prompt): void;
  setPreferences(preferences: Preferences): Promise<void>;
}

function emptyDraft(settings: PromptSettings): Draft {
  return {
    id: 'current',
    promptId: null,
    title: '',
    text: '',
    settings,
    baseUpdatedAt: null,
    drive: null,
  };
}

function draftFromPrompt(prompt: Prompt): Draft {
  return {
    id: 'current',
    promptId: prompt.id,
    title: prompt.title,
    text: prompt.text,
    settings: prompt.settings,
    baseUpdatedAt: prompt.updatedAt,
    drive: prompt.drive,
  };
}

/** État « modifié » (spec technique §6.1). */
export function isDirty(draft: Draft, saved: Prompt | null): boolean {
  if (draft.promptId === null || saved === null) return draft.text.trim() !== '';
  return (
    draft.title !== saved.title ||
    draft.text !== saved.text ||
    JSON.stringify(draft.settings) !== JSON.stringify(saved.settings)
  );
}

export const useSession = create<SessionState>()((set, get) => {
  const statsFor = (draft: Draft) =>
    computeStats(draft.text, draft.settings, get().measuredDistance);

  const patchDraft = (patch: Partial<Draft>) => set({ draft: { ...get().draft, ...patch } });

  return {
    ready: false,
    draft: emptyDraft(DEFAULT_PREFERENCES.defaultSettings),
    saved: null,
    preferences: DEFAULT_PREFERENCES,
    measuredDistance: null,

    async init() {
      const [preferences, storedDraft] = await Promise.all([loadPreferences(), loadDraft()]);
      let draft = storedDraft ?? emptyDraft(preferences.defaultSettings);
      let saved: Prompt | null = null;
      if (draft.promptId) {
        saved = (await getPrompt(draft.promptId)) ?? null;
        if (!saved) draft = { ...draft, promptId: null, baseUpdatedAt: null };
      }
      set({ ready: true, preferences, draft, saved });
    },

    setText: (text) => patchDraft({ text }),
    setTitle: (title) => patchDraft({ title }),
    updateSettings: (patch) => patchDraft({ settings: { ...get().draft.settings, ...patch } }),
    setMeasuredDistance: (measuredDistance) => set({ measuredDistance }),

    newPrompt() {
      set({ draft: emptyDraft(get().preferences.defaultSettings), saved: null });
    },

    openPrompt(prompt) {
      set({ draft: draftFromPrompt(prompt), saved: prompt });
    },

    loadShared(shared, drive = null) {
      set({
        draft: {
          ...emptyDraft(shared.settings),
          title: shared.title,
          text: shared.text,
          drive,
        },
        saved: null,
      });
    },

    async save({ title, force = false } = {}) {
      const { draft } = get();
      const finalTitle = (title ?? draft.title).trim();
      if (draft.promptId === null) {
        if (!finalTitle) return { status: 'needs-title' };
        const prompt = await createPrompt({
          title: finalTitle,
          text: draft.text,
          settings: draft.settings,
          stats: statsFor(draft),
        });
        void requestPersistentStorage();
        set({ draft: draftFromPrompt(prompt), saved: prompt });
        return { status: 'saved', prompt };
      }
      const current = await getPrompt(draft.promptId);
      if (!current) {
        // Supprimé entre-temps (autre onglet) : on recrée.
        patchDraft({ promptId: null, baseUpdatedAt: null });
        return get().save({ title: finalTitle || defaultTitle(draft.text), force });
      }
      if (!force && current.updatedAt !== draft.baseUpdatedAt) return { status: 'conflict' };
      const prompt = await updatePrompt(draft.promptId, {
        title: finalTitle || current.title,
        text: draft.text,
        settings: draft.settings,
        stats: statsFor(draft),
      });
      set({ draft: draftFromPrompt(prompt), saved: prompt });
      return { status: 'saved', prompt };
    },

    async saveAs(title) {
      const { draft } = get();
      const prompt = await createPrompt({
        title: title.trim(),
        text: draft.text,
        settings: draft.settings,
        stats: statsFor(draft),
      });
      void requestPersistentStorage();
      set({ draft: draftFromPrompt(prompt), saved: prompt });
      return prompt;
    },

    detach() {
      patchDraft({ promptId: null, baseUpdatedAt: null });
      set({ saved: null });
    },

    refreshSaved(prompt) {
      const { draft, saved } = get();
      if (draft.promptId !== prompt.id) return;
      // Seul le titre peut changer depuis la bibliothèque ; on le reporte s'il n'a pas été modifié ici.
      const title = saved && draft.title === saved.title ? prompt.title : draft.title;
      set({ saved: prompt, draft: { ...draft, title, baseUpdatedAt: prompt.updatedAt } });
    },

    async setPreferences(preferences) {
      await savePreferences(preferences);
      set({ preferences });
    },
  };
});

const DRAFT_DEBOUNCE_MS = 500;

/**
 * Conserve le brouillon (spec technique §6.1) : écriture 500 ms après la dernière modification,
 * et immédiatement quand la page est masquée.
 */
export function startDraftPersistence(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Draft | null = null;

  const flush = () => {
    clearTimeout(timer);
    if (pending) void saveDraft(pending);
    pending = null;
  };

  const unsubscribe = useSession.subscribe((state, previous) => {
    if (!state.ready || state.draft === previous.draft) return;
    pending = state.draft;
    clearTimeout(timer);
    timer = setTimeout(flush, DRAFT_DEBOUNCE_MS);
  });

  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', onHide);

  return () => {
    flush();
    unsubscribe();
    window.removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', onHide);
  };
}
