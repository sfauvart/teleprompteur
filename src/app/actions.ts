import {
  promptExportFileName,
  libraryExportFileName,
  textExportFileName,
} from '../domain/filename';
import { buildShareLink, decodeSharedPrompt, type RestoreFragment } from '../domain/shareLink';
import type { SharedPrompt } from '../domain/sharedPrompt';
import { computeStats } from '../domain/stats';
import { defaultTitle } from '../domain/text';
import { fr } from '../i18n/fr';
import { shareLink } from '../services/clipboard';
import { download, pickFiles } from '../services/fileSaver';
import {
  ImportError,
  buildExportFile,
  countConflicts,
  exportAsText,
  readImportFile,
  resolveImport,
  serializeExportFile,
} from '../storage/exchange';
import { listPrompts, putPrompts } from '../storage/promptsRepo';
import type { Prompt } from '../storage/types';
import { isDirty, useSession } from '../stores/sessionStore';
import { askText, choose, toast } from '../ui/feedback';
import { openDriveLink } from './driveActions';
import { navigate } from './router';

/** Enregistre le prompt courant (titre demandé au premier enregistrement, conflit géré). */
export async function saveCurrent(): Promise<boolean> {
  const session = useSession.getState();
  let result = await session.save();
  if (result.status === 'needs-title') {
    const { draft } = useSession.getState();
    const title = await askText({
      title: fr.save.titleDialog,
      label: fr.save.titleLabel,
      initial: draft.title || defaultTitle(draft.text),
    });
    if (title === null) return false;
    result = await useSession.getState().save({ title });
  }
  if (result.status === 'conflict') {
    const choice = await choose({
      title: fr.save.conflictTitle,
      message: fr.save.conflictMessage,
      actions: [
        { value: 'cancel', label: fr.common.cancel },
        { value: 'overwrite', label: fr.save.overwrite, variant: 'danger' },
      ],
    });
    if (choice !== 'overwrite') return false;
    result = await useSession.getState().save({ force: true });
  }
  if (result.status !== 'saved') return false;
  toast(fr.save.saved);
  return true;
}

export async function saveCurrentAs(): Promise<boolean> {
  const { draft } = useSession.getState();
  const title = await askText({
    title: fr.save.saveAsDialog,
    label: fr.save.titleLabel,
    initial: draft.title ? `${draft.title}${fr.library.copySuffix}` : defaultTitle(draft.text),
  });
  if (title === null) return false;
  await useSession.getState().saveAs(title);
  toast(fr.save.saved);
  return true;
}

/**
 * Avant une action qui remplacerait le brouillon : « Enregistrer / Ne pas enregistrer / Annuler ».
 * Renvoie vrai si l'action peut continuer.
 */
export async function confirmLeaveDraft(title: string = fr.save.unsavedTitle): Promise<boolean> {
  const { draft, saved } = useSession.getState();
  if (!isDirty(draft, saved)) return true;
  const choice = await choose({
    title,
    message: fr.save.unsavedMessage,
    actions: [
      { value: 'cancel', label: fr.common.cancel },
      { value: 'discard', label: fr.common.dontSave },
      { value: 'save', label: fr.common.save, variant: 'primary' },
    ],
  });
  if (choice === 'discard') return true;
  if (choice === 'save') return saveCurrent();
  return false;
}

export async function newPrompt(): Promise<void> {
  if (!(await confirmLeaveDraft())) return;
  useSession.getState().newPrompt();
  navigate('editor');
}

export async function openPrompt(prompt: Prompt, target: 'editor' | 'prompter'): Promise<void> {
  const { draft } = useSession.getState();
  if (draft.promptId !== prompt.id) {
    if (!(await confirmLeaveDraft())) return;
    useSession.getState().openPrompt(prompt);
  }
  navigate(target);
}

// --- Lien de partage (F28) ---

function appBaseUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}

export async function copyShareLink(prompt: SharedPrompt): Promise<void> {
  if (!prompt.text.trim()) {
    toast(fr.share.empty, { tone: 'error' });
    return;
  }
  const link = buildShareLink(prompt, appBaseUrl());
  if (link.status === 'too-long') {
    toast(fr.share.tooLong, { tone: 'error', durationMs: 8000 });
    return;
  }
  const outcome = await shareLink(link.url, prompt.title || fr.appName);
  if (outcome === 'failed') toast(fr.share.failed, { tone: 'error' });
  else if (outcome === 'cancelled') return;
  else if (link.status === 'long') toast(fr.share.long, { durationMs: 8000 });
  else toast(outcome === 'shared' ? fr.share.shared : fr.share.copied);
}

/** Traite un fragment `#prompt=` / `#gdrive=` (spec technique §6.5). */
export async function handleRestoreFragment(fragment: RestoreFragment): Promise<void> {
  if (fragment.kind === 'invalid-gdrive') {
    toast(fr.share.driveInvalid, { tone: 'error' });
    return;
  }
  if (fragment.kind === 'gdrive') {
    await openDriveLink(fragment.fileId);
    return;
  }
  let shared: SharedPrompt;
  try {
    shared = decodeSharedPrompt(fragment.payload);
  } catch {
    toast(fr.share.invalid, { tone: 'error' });
    return;
  }
  if (!(await confirmLeaveDraft(fr.share.replaceTitle))) return;
  useSession.getState().loadShared(shared);
  navigate('editor', { replace: true });
  toast(fr.share.loaded);
}

// --- Import / export (F24) ---

export function exportPrompts(prompts: Prompt[], single: boolean): void {
  if (prompts.length === 0) {
    toast(fr.importExport.nothing, { tone: 'error' });
    return;
  }
  const json = serializeExportFile(buildExportFile(prompts));
  const name =
    single && prompts[0]
      ? promptExportFileName(prompts[0].title)
      : libraryExportFileName(new Date());
  download(new Blob([json], { type: 'application/json' }), name);
}

export function exportCurrent(format: 'json' | 'md' | 'txt'): void {
  const { draft, saved, measuredDistance } = useSession.getState();
  const title = draft.title || defaultTitle(draft.text) || fr.appName;
  if (format === 'json') {
    const now = new Date().toISOString();
    const prompt: Prompt = {
      id: draft.promptId ?? crypto.randomUUID(),
      title,
      text: draft.text,
      settings: draft.settings,
      lastPosition: null,
      stats: computeStats(draft.text, draft.settings, measuredDistance),
      drive: null,
      createdAt: saved?.createdAt ?? now,
      updatedAt: saved?.updatedAt ?? now,
      lastUsedAt: null,
    };
    exportPrompts([prompt], true);
    return;
  }
  const mime = format === 'md' ? 'text/markdown' : 'text/plain';
  download(
    new Blob([exportAsText(draft.text, format)], { type: `${mime};charset=utf-8` }),
    textExportFileName(title, format),
  );
}

export async function importFromFiles(): Promise<void> {
  const [file] = await pickFiles(
    '.json,.md,.markdown,.txt,application/json,text/plain,text/markdown',
  );
  if (!file) return;
  try {
    const imported = await readImportFile(file);
    if (imported.kind === 'text') {
      if (!(await confirmLeaveDraft())) return;
      const settings = useSession.getState().preferences.defaultSettings;
      useSession.getState().loadShared({ title: imported.title, text: imported.text, settings });
      navigate('editor');
      toast(fr.importExport.importedText(imported.title));
      return;
    }
    const existing = new Set((await listPrompts()).map((p) => p.id));
    const conflicts = countConflicts(imported.prompts, existing);
    let strategy: 'replace' | 'keep-both' = 'keep-both';
    if (conflicts > 0) {
      const choice = await choose({
        title: fr.importExport.conflictTitle,
        message: fr.importExport.conflictMessage(conflicts),
        actions: [
          { value: 'cancel', label: fr.common.cancel },
          { value: 'keep-both', label: fr.common.keepBoth },
          { value: 'replace', label: fr.common.replace, variant: 'primary' },
        ],
      });
      if (choice !== 'replace' && choice !== 'keep-both') return;
      strategy = choice;
    }
    const prompts = resolveImport(imported.prompts, existing, strategy, (text, settings) =>
      computeStats(text, settings),
    );
    await putPrompts(prompts);
    // Le prompt en cours a pu être remplacé : on met à jour sa référence.
    const session = useSession.getState();
    const replaced = prompts.find((p) => p.id === session.draft.promptId);
    if (replaced) session.refreshSaved(replaced);
    toast(fr.importExport.imported(prompts.length));
  } catch (error) {
    toast(error instanceof ImportError ? error.message : fr.importExport.error, { tone: 'error' });
  }
}
