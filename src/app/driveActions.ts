import { create } from 'zustand';
import { promptExportFileName } from '../domain/filename';
import type { PromptSettings } from '../domain/settings';
import type { SharedPrompt } from '../domain/sharedPrompt';
import { hashText } from '../domain/text';
import { fr } from '../i18n/fr';
import { shareLink } from '../services/clipboard';
import { DriveAuthError, getAccessToken, invalidateToken } from '../services/google/auth';
import { isDriveConfigured } from '../services/google/config';
import {
  DriveError,
  createFile,
  ensureFolder,
  getContent,
  getMetadata,
  listAppFiles,
  makePublic,
  publicCredentials,
  updateFile,
  type DriveCredentials,
  type DriveFile,
} from '../services/google/drive';
import { pickFile } from '../services/google/picker';
import {
  ImportError,
  buildExportFile,
  parseExportFile,
  serializeExportFile,
} from '../storage/exchange';
import { findPromptByDriveFile } from '../storage/promptsRepo';
import type { DriveLink } from '../storage/types';
import { useSession } from '../stores/sessionStore';
import { choose, toast } from '../ui/feedback';
import { confirmLeaveDraft, saveCurrent } from './actions';
import { navigate } from './router';

/** Empreinte du contenu envoyé : indicateur « modifié depuis le dernier envoi » (F29). */
export function driveContentHash(prompt: {
  title: string;
  text: string;
  settings: PromptSettings;
}): string {
  return hashText(JSON.stringify([prompt.title, prompt.text, prompt.settings]));
}

export function isModifiedSinceDrive(prompt: {
  title: string;
  text: string;
  settings: PromptSettings;
  drive: DriveLink | null;
}): boolean {
  return prompt.drive !== null && driveContentHash(prompt) !== prompt.drive.contentHash;
}

function driveLink(file: DriveFile, prompt: SharedPrompt): DriveLink {
  return {
    fileId: file.id,
    modifiedTime: file.modifiedTime,
    contentHash: driveContentHash(prompt),
    canEdit: file.canEdit,
  };
}

function reportError(error: unknown): void {
  if (error instanceof DriveAuthError) {
    const blocked = /popup/i.test(error.message);
    toast(blocked ? fr.drive.popupBlocked : fr.drive.authFailed, { tone: 'error' });
    return;
  }
  if (error instanceof ImportError) {
    toast(fr.drive.invalidFile, { tone: 'error' });
    return;
  }
  if (error instanceof DriveError) {
    if (error.kind === 'auth') invalidateToken();
    const messages: Record<DriveError['kind'], string> = {
      auth: fr.drive.expired,
      forbidden: fr.drive.forbidden,
      'not-found': fr.drive.notFound,
      network: fr.drive.network,
      invalid: fr.drive.invalidFile,
      other: fr.drive.error,
    };
    toast(messages[error.kind], { tone: 'error' });
    return;
  }
  toast(fr.drive.error, { tone: 'error' });
}

function checkAvailable(): boolean {
  if (!isDriveConfigured()) {
    toast(fr.drive.unavailable, { tone: 'error' });
    return false;
  }
  if (!navigator.onLine) {
    toast(fr.drive.offline, { tone: 'error' });
    return false;
  }
  return true;
}

/** Démarre la demande de jeton dès le clic (sinon la fenêtre Google est bloquée). */
function startToken(): Promise<string> {
  const promise = getAccessToken();
  promise.catch(() => undefined);
  return promise;
}

// --- Ouverture ---

/** Charge le contenu d'un fichier Drive dans l'éditeur (règles du lien de partage, §6.5). */
async function applyDriveContent(file: DriveFile, content: string): Promise<void> {
  const [first] = parseExportFile(content);
  if (!first) throw new ImportError(fr.drive.invalidFile);
  const shared: SharedPrompt = { title: first.title, text: first.text, settings: first.settings };
  const local = (await findPromptByDriveFile(file.id)) ?? null;
  const session = useSession.getState();
  if (!(local && session.draft.promptId === local.id) && !(await confirmLeaveDraft())) return;
  useSession.getState().loadDrivePrompt(shared, driveLink(file, shared), local);
  navigate('editor', { replace: true });
  toast(fr.drive.opened);
}

async function readFile(credentials: DriveCredentials, fileId: string) {
  return Promise.all([getMetadata(credentials, fileId), getContent(credentials, fileId)]);
}

export async function openDriveFile(fileId: string, tokenPromise = startToken()): Promise<void> {
  try {
    const token = await tokenPromise;
    const [file, content] = await readFile({ token }, fileId);
    await applyDriveContent(file, content);
  } catch (error) {
    reportError(error);
  }
}

/** Sélecteur Google : fichiers partagés par d'autres personnes. */
export async function openWithPicker(fileId?: string): Promise<void> {
  try {
    const token = await startToken();
    const picked = await pickFile(token, fileId);
    if (picked) await openDriveFile(picked, Promise.resolve(token));
  } catch (error) {
    reportError(error);
  }
}

interface DriveBrowserState {
  open: boolean;
  loading: boolean;
  files: DriveFile[];
  close(): void;
}

export const useDriveBrowser = create<DriveBrowserState>()((set) => ({
  open: false,
  loading: false,
  files: [],
  close: () => set({ open: false }),
}));

/** « Ouvrir depuis Drive… » : liste des prompts enregistrés par l'application. */
export async function browseDrive(): Promise<void> {
  if (!checkAvailable()) return;
  const tokenPromise = startToken();
  try {
    const token = await tokenPromise;
    useDriveBrowser.setState({ open: true, loading: true, files: [] });
    const files = await listAppFiles(token);
    useDriveBrowser.setState({ loading: false, files });
  } catch (error) {
    useDriveBrowser.setState({ open: false, loading: false });
    reportError(error);
  }
}

/** Lien `#gdrive=` (spec technique §6.6) : public d'abord, puis connexion, puis sélecteur. */
export async function openDriveLink(fileId: string): Promise<void> {
  if (!checkAvailable()) return;
  try {
    const [file, content] = await readFile(publicCredentials(), fileId);
    await applyDriveContent({ ...file, canEdit: false }, content);
    return;
  } catch (error) {
    if (!(error instanceof DriveError) || error.kind === 'network') return reportError(error);
  }
  const choice = await choose({
    title: fr.drive.linkTitle,
    message: fr.drive.linkMessage,
    actions: [
      { value: 'cancel', label: fr.common.cancel },
      { value: 'connect', label: fr.drive.connectAndOpen, variant: 'primary' },
    ],
  });
  if (choice !== 'connect') return;
  const tokenPromise = startToken();
  try {
    const token = await tokenPromise;
    try {
      const [file, content] = await readFile({ token }, fileId);
      await applyDriveContent(file, content);
    } catch (error) {
      // Fichier non encore accessible à l'application (portée drive.file) : le sélecteur l'ouvre.
      if (
        !(error instanceof DriveError) ||
        (error.kind !== 'not-found' && error.kind !== 'forbidden')
      ) {
        throw error;
      }
      const picked = await pickFile(token, fileId);
      if (picked) await openDriveFile(picked, Promise.resolve(token));
    }
  } catch (error) {
    reportError(error);
  }
}

// --- Enregistrement ---

/**
 * « Enregistrer dans Drive » : enregistrement local, puis création ou mise à jour du fichier,
 * avec détection des conflits (spec technique §6.6).
 */
export async function saveToDrive(tokenPromise?: Promise<string>): Promise<void> {
  if (!checkAvailable()) return;
  const tokenRequest = tokenPromise ?? startToken();
  if (!(await saveCurrent())) return;
  try {
    const token = await tokenRequest;
    const session = useSession.getState();
    const { draft, preferences } = session;
    const shared: SharedPrompt = { title: draft.title, text: draft.text, settings: draft.settings };
    const prompt = session.saved;
    if (!prompt) return;
    const content = serializeExportFile(buildExportFile([prompt]));
    const name = promptExportFileName(draft.title);

    const create = async () => {
      const folderId = await ensureFolder(token, preferences.driveFolderId);
      if (folderId !== preferences.driveFolderId) {
        await session.setPreferences({ ...preferences, driveFolderId: folderId });
      }
      return createFile(token, name, content, folderId);
    };

    let file: DriveFile | null = null;
    if (!draft.drive) {
      file = await create();
    } else {
      let remote: DriveFile | null = null;
      try {
        remote = await getMetadata({ token }, draft.drive.fileId);
      } catch (error) {
        if (!(error instanceof DriveError) || error.kind !== 'not-found') throw error;
      }
      if (!remote) {
        const choice = await choose({
          title: fr.drive.missingTitle,
          message: fr.drive.missingMessage,
          actions: [
            { value: 'cancel', label: fr.common.cancel },
            { value: 'create', label: fr.drive.create, variant: 'primary' },
          ],
        });
        if (choice !== 'create') return;
        file = await create();
      } else if (!remote.canEdit) {
        const choice = await choose({
          title: fr.drive.readOnlyTitle,
          message: fr.drive.readOnlyMessage,
          actions: [
            { value: 'cancel', label: fr.common.cancel },
            { value: 'copy', label: fr.drive.saveCopy, variant: 'primary' },
          ],
        });
        if (choice !== 'copy') return;
        file = await create();
      } else {
        if (remote.modifiedTime !== draft.drive.modifiedTime) {
          const choice = await choose({
            title: fr.drive.conflictTitle,
            message: fr.drive.conflictMessage,
            actions: [
              { value: 'cancel', label: fr.common.cancel },
              { value: 'load', label: fr.drive.loadRemote },
              { value: 'overwrite', label: fr.drive.overwrite, variant: 'danger' },
            ],
          });
          if (choice === 'load') {
            await applyDriveContent(remote, await getContent({ token }, remote.id));
            return;
          }
          if (choice !== 'overwrite') return;
        }
        file = await updateFile(token, remote.id, name, content);
      }
    }
    await useSession.getState().setDriveLink(driveLink(file, shared));
    toast(fr.drive.saved);
  } catch (error) {
    reportError(error);
  }
}

// --- Partage ---

function driveUrl(fileId: string): string {
  return `${new URL(import.meta.env.BASE_URL, window.location.origin).href}#gdrive=${fileId}`;
}

export async function copyDriveLink(): Promise<void> {
  const { draft } = useSession.getState();
  if (!draft.drive) {
    toast(fr.drive.noLink, { tone: 'error' });
    return;
  }
  const outcome = await shareLink(driveUrl(draft.drive.fileId), draft.title || fr.appName);
  if (outcome === 'failed') toast(fr.share.failed, { tone: 'error' });
  else if (outcome === 'copied') toast(fr.drive.linkCopied);
}

export async function makeDriveFilePublic(): Promise<void> {
  const { draft } = useSession.getState();
  if (!draft.drive) {
    toast(fr.drive.noLink, { tone: 'error' });
    return;
  }
  if (!checkAvailable()) return;
  const tokenPromise = startToken();
  const choice = await choose({
    title: fr.drive.publicTitle,
    message: fr.drive.publicMessage,
    actions: [
      { value: 'cancel', label: fr.common.cancel },
      { value: 'ok', label: fr.common.confirm, variant: 'primary' },
    ],
  });
  if (choice !== 'ok') return;
  try {
    await makePublic(await tokenPromise, draft.drive.fileId);
    const outcome = await shareLink(driveUrl(draft.drive.fileId), draft.title || fr.appName);
    toast(outcome === 'failed' ? fr.share.failed : fr.drive.publicDone);
  } catch (error) {
    reportError(error);
  }
}
