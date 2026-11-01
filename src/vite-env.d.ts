/// <reference types="vite/client" />

/** Version de l'application (package.json), injectée au build. */
declare const __APP_VERSION__: string;

/** Nonce de la Content-Security-Policy, généré à chaque build (styles injectés par CodeMirror). */
declare const __CSP_NONCE__: string;
