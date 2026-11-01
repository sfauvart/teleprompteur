import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { handleRestoreFragment } from './app/actions';
import { registerServiceWorker } from './app/pwa';
import { clearRestoreFragment } from './app/router';
import { parseRestoreFragment } from './domain/shareLink';
import { startDraftPersistence, useSession } from './stores/sessionStore';
import './styles/global.css';

/** Fragments `#prompt=` / `#gdrive=` : interceptés avant le rendu (spec technique §4.3). */
function takeRestoreFragment() {
  const fragment = parseRestoreFragment(window.location.hash);
  if (fragment) clearRestoreFragment();
  return fragment;
}

const initialFragment = takeRestoreFragment();

await useSession.getState().init();
startDraftPersistence();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (initialFragment) void handleRestoreFragment(initialFragment);

// Lien ouvert alors que l'application est déjà chargée.
window.addEventListener('hashchange', () => {
  const fragment = takeRestoreFragment();
  if (fragment) void handleRestoreFragment(fragment);
});

registerServiceWorker();
