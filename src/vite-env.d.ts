/// <reference types="vite/client" />

/** Version de l'application (package.json), injectée au build. */
declare const __APP_VERSION__: string;

/** Nonce de la Content-Security-Policy, généré à chaque build (styles injectés par CodeMirror). */
declare const __CSP_NONCE__: string;

interface ImportMetaEnv {
  /** Identifiants Google publics (F29), voir `.env.local` et les variables du dépôt GitHub. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_API_KEY?: string;
  readonly VITE_GOOGLE_APP_ID?: string;
}
