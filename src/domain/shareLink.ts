import { Inflate, deflateSync, strFromU8, strToU8 } from 'fflate';
import { sharedPromptSchema, type SharedPrompt } from './sharedPrompt';

/** Paramètres du lien `#prompt=` (spec technique §6.5). */
export const SHARE_LINK = {
  prefix: 'prompt=',
  version: '1',
  warnLength: 8_000,
  maxLength: 64_000,
  maxFragmentLength: 128_000,
  maxDecompressedBytes: 1_000_000,
} as const;

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('base64url invalide');
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Décompression bornée : s'interrompt dès que la limite est dépassée. */
function boundedInflate(data: Uint8Array, maxBytes: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const inflater = new Inflate((chunk) => {
    total += chunk.length;
    if (total > maxBytes) throw new Error('Contenu décompressé trop volumineux');
    chunks.push(chunk);
  });
  inflater.push(data, true);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Charge utile `1.<base64url(deflate(JSON))>`. */
export function encodeSharedPrompt(prompt: SharedPrompt): string {
  const json = JSON.stringify({
    title: prompt.title,
    text: prompt.text,
    settings: prompt.settings,
  });
  return `${SHARE_LINK.version}.${base64UrlEncode(deflateSync(strToU8(json), { level: 9 }))}`;
}

export function decodeSharedPrompt(payload: string): SharedPrompt {
  if (payload.length > SHARE_LINK.maxFragmentLength) throw new Error('Lien trop long');
  const dot = payload.indexOf('.');
  if (dot < 0 || payload.slice(0, dot) !== SHARE_LINK.version) {
    throw new Error('Version de lien inconnue');
  }
  const bytes = boundedInflate(
    base64UrlDecode(payload.slice(dot + 1)),
    SHARE_LINK.maxDecompressedBytes,
  );
  return sharedPromptSchema.parse(JSON.parse(strFromU8(bytes)));
}

export type ShareLinkStatus = 'ok' | 'long' | 'too-long';

export interface ShareLink {
  url: string;
  status: ShareLinkStatus;
}

/** @param baseUrl adresse de l'application, ex. https://www.sebastien-fauvart.fr/teleprompteur/ */
export function buildShareLink(prompt: SharedPrompt, baseUrl: string): ShareLink {
  const url = `${baseUrl.replace(/#.*$/, '')}#${SHARE_LINK.prefix}${encodeSharedPrompt(prompt)}`;
  const status: ShareLinkStatus =
    url.length > SHARE_LINK.maxLength
      ? 'too-long'
      : url.length > SHARE_LINK.warnLength
        ? 'long'
        : 'ok';
  return { url, status };
}

export type RestoreFragment =
  | { kind: 'prompt'; payload: string }
  | { kind: 'gdrive'; fileId: string }
  | { kind: 'invalid-gdrive' };

/** Reconnaît `#prompt=…` et `#gdrive=…` ; les routes (`#/…`) et le reste renvoient null. */
export function parseRestoreFragment(hash: string): RestoreFragment | null {
  const fragment = hash.replace(/^#/, '');
  if (fragment.startsWith(SHARE_LINK.prefix)) {
    return { kind: 'prompt', payload: fragment.slice(SHARE_LINK.prefix.length) };
  }
  if (fragment.startsWith('gdrive=')) {
    const fileId = fragment.slice('gdrive='.length);
    return /^[A-Za-z0-9_-]{10,128}$/.test(fileId)
      ? { kind: 'gdrive', fileId }
      : { kind: 'invalid-gdrive' };
  }
  return null;
}
