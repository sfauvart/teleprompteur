import { useSyncExternalStore } from 'react';

/** Routes en mode fragment (spec technique §4.3). */
export type Route = 'editor' | 'prompter' | 'library' | 'preferences';

const PATHS: Record<Route, string> = {
  editor: '#/',
  prompter: '#/lecture',
  library: '#/prompts',
  preferences: '#/preferences',
};

export function routeFromHash(hash: string): Route {
  switch (hash) {
    case '#/lecture':
      return 'prompter';
    case '#/prompts':
      return 'library';
    case '#/preferences':
      return 'preferences';
    default:
      return 'editor';
  }
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => routeFromHash(window.location.hash));
}

/** Marque les entrées d'historique créées par l'application. */
interface AppHistoryState {
  app: true;
}

export function navigate(route: Route, { replace = false } = {}): void {
  const path = PATHS[route];
  if (window.location.hash === path) return;
  const state: AppHistoryState = { app: true };
  if (replace) history.replaceState(state, '', path);
  else history.pushState(state, '', path);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Revient en arrière si l'entrée courante a été créée par l'application, sinon va à `route`. */
export function goBack(route: Route): void {
  const state = history.state as Partial<AppHistoryState> | null;
  if (state?.app && history.length > 1) history.back();
  else navigate(route, { replace: true });
}

/** Retire un fragment de restauration de l'adresse sans créer d'entrée d'historique. */
export function clearRestoreFragment(): void {
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`);
}
