import { create } from 'zustand';
import { DRIVE_SCOPE, googleConfig } from './config';
import { GIS_SCRIPT, loadScript } from './scriptLoader';

/** Marge avant expiration du jeton (ms). */
const EXPIRY_MARGIN_MS = 60_000;
/** Indicateur « déjà connecté » (sans jeton) pour proposer une reconnexion silencieuse. */
const CONNECTED_HINT_KEY = 'teleprompteur.drive.connected';

export class DriveAuthError extends Error {}

interface DriveAuthState {
  /** L'utilisateur a déjà autorisé l'application (indicateur, pas un jeton). */
  connected: boolean;
}

function readHint(): boolean {
  try {
    return localStorage.getItem(CONNECTED_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHint(connected: boolean): void {
  try {
    if (connected) localStorage.setItem(CONNECTED_HINT_KEY, '1');
    else localStorage.removeItem(CONNECTED_HINT_KEY);
  } catch {
    // Stockage indisponible : l'utilisateur se reconnectera.
  }
}

export const useDriveAuth = create<DriveAuthState>()(() => ({ connected: readHint() }));

/** Jeton d'accès : en mémoire uniquement, jamais enregistré ni journalisé. */
let token: { value: string; expiresAt: number } | null = null;
let client: google.accounts.oauth2.TokenClient | null = null;
let pending: {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
} | null = null;

function settle(result: { token: string } | { error: Error }): void {
  const current = pending;
  pending = null;
  if (!current) return;
  if ('token' in result) current.resolve(result.token);
  else current.reject(result.error);
}

/** Précharge Google Identity Services, pour que la demande de jeton reste liée au clic. */
export function preloadAuth(): Promise<void> {
  return loadScript(GIS_SCRIPT).then(() => {
    client ??= google.accounts.oauth2.initTokenClient({
      client_id: googleConfig.clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          settle({ error: new DriveAuthError(response.error_description || response.error) });
          return;
        }
        token = {
          value: response.access_token,
          expiresAt: Date.now() + Number(response.expires_in) * 1000,
        };
        writeHint(true);
        useDriveAuth.setState({ connected: true });
        settle({ token: token.value });
      },
      error_callback: (error) => settle({ error: new DriveAuthError(error.message || error.type) }),
    });
  });
}

export function hasValidToken(): boolean {
  return token !== null && token.expiresAt - EXPIRY_MARGIN_MS > Date.now();
}

/**
 * Renvoie un jeton valide, en ouvrant au besoin la fenêtre Google.
 * À appeler au plus tôt dans le gestionnaire du clic : la fenêtre est sinon bloquée.
 */
export function getAccessToken(): Promise<string> {
  if (token && hasValidToken()) return Promise.resolve(token.value);
  const request = (resolve: (t: string) => void, reject: (e: Error) => void) => {
    pending?.reject(new DriveAuthError('Demande remplacée'));
    pending = { resolve, reject };
    // Sans écran de consentement si l'accès a déjà été accordé.
    client!.requestAccessToken({ prompt: useDriveAuth.getState().connected ? '' : 'consent' });
  };
  if (client) return new Promise(request);
  return preloadAuth().then(() => new Promise(request));
}

/** Jeton refusé par l'API (401) : il sera redemandé à la prochaine action. */
export function invalidateToken(): void {
  token = null;
}

export function disconnect(): void {
  if (token && typeof google !== 'undefined') google.accounts.oauth2.revoke(token.value, () => {});
  token = null;
  writeHint(false);
  useDriveAuth.setState({ connected: false });
}
