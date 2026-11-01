import { Workbox } from 'workbox-window';
import { fr } from '../i18n/fr';
import { toast } from '../ui/feedback';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Service worker (spec technique §11) : mise à jour proposée, jamais imposée ;
 * `updateViaCache: 'none'` contourne le cache HTTP de GitHub Pages.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  const wb = new Workbox(`${base}sw.js`, { scope: base, updateViaCache: 'none' });

  wb.addEventListener('waiting', () => {
    toast(fr.update.available, {
      durationMs: 0,
      action: {
        label: fr.update.reload,
        run: () => {
          wb.addEventListener('controlling', () => window.location.reload());
          wb.messageSkipWaiting();
        },
      },
    });
  });

  void wb.register().then(() => {
    setInterval(() => void wb.update(), UPDATE_CHECK_INTERVAL_MS);
  });
}
