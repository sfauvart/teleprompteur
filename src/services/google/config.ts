/** Identifiants Google publics, injectés au build (spec technique §6.6). */
export const googleConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY ?? '',
  appId: import.meta.env.VITE_GOOGLE_APP_ID ?? '',
};

/** Sans identifiants, les fonctions Drive sont masquées. */
export function isDriveConfigured(): boolean {
  return Boolean(googleConfig.clientId && googleConfig.apiKey && googleConfig.appId);
}

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
