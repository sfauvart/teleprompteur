import { googleConfig } from './config';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FILE_FIELDS = 'id,name,modifiedTime,capabilities/canEdit';

export const APP_PROPERTIES = { app: 'teleprompteur', format: '1' } as const;
export const FOLDER_NAME = 'Téléprompteur';

export type DriveErrorKind = 'auth' | 'forbidden' | 'not-found' | 'network' | 'invalid' | 'other';

export class DriveError extends Error {
  readonly kind: DriveErrorKind;
  readonly status: number;

  constructor(kind: DriveErrorKind, status = 0, message: string = kind) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  canEdit: boolean;
}

interface RawFile {
  id: string;
  name?: string;
  modifiedTime?: string;
  capabilities?: { canEdit?: boolean };
  trashed?: boolean;
}

function toDriveFile(raw: RawFile): DriveFile {
  return {
    id: raw.id,
    name: raw.name ?? '',
    modifiedTime: raw.modifiedTime ?? '',
    canEdit: raw.capabilities?.canEdit ?? false,
  };
}

function errorKind(status: number): DriveErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  return 'other';
}

/** Accès authentifié (jeton) ou public (clé d'API, fichiers partagés par lien). */
export type DriveCredentials = { token: string } | { apiKey: string };

async function request(
  url: string,
  credentials: DriveCredentials,
  init: RequestInit = {},
): Promise<Response> {
  const target = new URL(url);
  const headers = new Headers(init.headers);
  if ('token' in credentials) headers.set('Authorization', `Bearer ${credentials.token}`);
  else target.searchParams.set('key', credentials.apiKey);
  let response: Response;
  try {
    response = await fetch(target, { ...init, headers });
  } catch {
    throw new DriveError('network');
  }
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      // Corps non JSON.
    }
    throw new DriveError(errorKind(response.status), response.status, message);
  }
  return response;
}

/** Corps `multipart/related` : métadonnées JSON puis contenu (upload Drive v3). */
export function multipartBody(
  metadata: object,
  content: string,
  boundary = `teleprompteur-${crypto.randomUUID()}`,
): { body: string; contentType: string } {
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${content}\r\n--${boundary}--`;
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

/** Dossier « Téléprompteur » : réutilisé s'il existe encore, sinon recréé. */
export async function ensureFolder(token: string, folderId: string | null): Promise<string> {
  if (folderId) {
    try {
      const response = await request(`${API}/files/${folderId}?fields=id,trashed`, { token });
      const folder = (await response.json()) as RawFile;
      if (!folder.trashed) return folder.id;
    } catch (error) {
      if (!(error instanceof DriveError) || error.kind !== 'not-found') throw error;
    }
  }
  const response = await request(
    `${API}/files?fields=id`,
    { token },
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: FOLDER_MIME,
        appProperties: APP_PROPERTIES,
      }),
    },
  );
  return ((await response.json()) as RawFile).id;
}

export async function createFile(
  token: string,
  name: string,
  content: string,
  folderId: string,
): Promise<DriveFile> {
  const { body, contentType } = multipartBody(
    { name, mimeType: 'application/json', parents: [folderId], appProperties: APP_PROPERTIES },
    content,
  );
  const response = await request(
    `${UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`,
    { token },
    { method: 'POST', headers: { 'Content-Type': contentType }, body },
  );
  return toDriveFile((await response.json()) as RawFile);
}

export async function updateFile(
  token: string,
  fileId: string,
  name: string,
  content: string,
): Promise<DriveFile> {
  const { body, contentType } = multipartBody({ name }, content);
  const response = await request(
    `${UPLOAD}/files/${fileId}?uploadType=multipart&fields=${FILE_FIELDS}`,
    { token },
    { method: 'PATCH', headers: { 'Content-Type': contentType }, body },
  );
  return toDriveFile((await response.json()) as RawFile);
}

export async function getMetadata(
  credentials: DriveCredentials,
  fileId: string,
): Promise<DriveFile> {
  const response = await request(`${API}/files/${fileId}?fields=${FILE_FIELDS}`, credentials);
  return toDriveFile((await response.json()) as RawFile);
}

export async function getContent(credentials: DriveCredentials, fileId: string): Promise<string> {
  const response = await request(`${API}/files/${fileId}?alt=media`, credentials);
  return response.text();
}

/** Prompts enregistrés par l'application dans le Drive de l'utilisateur. */
export async function listAppFiles(token: string): Promise<DriveFile[]> {
  const query = `appProperties has { key='app' and value='${APP_PROPERTIES.app}' } and mimeType != '${FOLDER_MIME}' and trashed = false`;
  const url = new URL(`${API}/files`);
  url.searchParams.set('q', query);
  url.searchParams.set('orderBy', 'modifiedTime desc');
  url.searchParams.set('pageSize', '100');
  url.searchParams.set('fields', `files(${FILE_FIELDS})`);
  const response = await request(url.href, { token });
  const body = (await response.json()) as { files?: RawFile[] };
  return (body.files ?? []).map(toDriveFile);
}

/** Lecture publique par lien : « toute personne disposant du lien ». */
export async function makePublic(token: string, fileId: string): Promise<void> {
  await request(
    `${API}/files/${fileId}/permissions?fields=id`,
    { token },
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    },
  );
}

export function publicCredentials(): DriveCredentials {
  return { apiKey: googleConfig.apiKey };
}
