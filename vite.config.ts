import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};

const BASE = '/teleprompteur/';

/**
 * Nonce de la CSP, régénéré à chaque build : autorise uniquement les `<style>` injectés par
 * CodeMirror (EditorView.cspNonce), sans recourir à 'unsafe-inline'.
 */
const CSP_NONCE = randomBytes(16).toString('base64');

// CSP en <meta> : GitHub Pages ne permet pas d'en-têtes HTTP personnalisés (spec technique §12).
// Injectée uniquement au build : le serveur de développement utilise des scripts en ligne.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com https://apis.google.com",
  `style-src 'self' 'nonce-${CSP_NONCE}' https://accounts.google.com`,
  "connect-src 'self' https://www.googleapis.com https://accounts.google.com",
  'frame-src https://accounts.google.com https://docs.google.com',
  "img-src 'self' data: blob: https://*.googleusercontent.com https://ssl.gstatic.com",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

/** Désactive le traitement Jekyll de GitHub Pages (spec technique §15). */
function noJekyll(): Plugin {
  return {
    name: 'no-jekyll',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
    },
  };
}

export default defineConfig({
  base: BASE,
  define: { __APP_VERSION__: JSON.stringify(version), __CSP_NONCE__: JSON.stringify(CSP_NONCE) },
  plugins: [
    react(),
    cspMeta(),
    noJekyll(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Téléprompteur',
        short_name: 'Téléprompteur',
        description: 'Téléprompteur hors ligne avec bibliothèque de prompts.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0d0d0d',
        background_color: '#0d0d0d',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/confidentialite\.html$/],
      },
    }),
  ],
  build: {
    target: 'es2022',
    // Bundle unique ≈ 250 Ko gzip, sous le budget de 300 Ko (spec technique §13).
    chunkSizeWarningLimit: 1000,
  },
});
