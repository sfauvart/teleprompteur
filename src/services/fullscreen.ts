/** Plein écran avec repli préfixé pour iPadOS (spec technique §9.2). */
interface WebkitDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

const doc = () => document as WebkitDocument;

export function isFullscreenSupported(): boolean {
  return !!(document.fullscreenEnabled || doc().webkitFullscreenEnabled);
}

export function fullscreenElement(): Element | null {
  return document.fullscreenElement ?? doc().webkitFullscreenElement ?? null;
}

export async function enterFullscreen(element: HTMLElement): Promise<void> {
  const el = element as WebkitElement;
  if (el.requestFullscreen) await el.requestFullscreen();
  else await el.webkitRequestFullscreen?.();
}

export async function exitFullscreen(): Promise<void> {
  if (!fullscreenElement()) return;
  if (document.exitFullscreen) await document.exitFullscreen();
  else await doc().webkitExitFullscreen?.();
}

export function onFullscreenChange(listener: () => void): () => void {
  document.addEventListener('fullscreenchange', listener);
  document.addEventListener('webkitfullscreenchange', listener);
  return () => {
    document.removeEventListener('fullscreenchange', listener);
    document.removeEventListener('webkitfullscreenchange', listener);
  };
}
