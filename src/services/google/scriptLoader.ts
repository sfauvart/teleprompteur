const loading = new Map<string, Promise<void>>();

/** Charge un script Google à la demande, une seule fois (spec technique §6.6). */
export function loadScript(src: string): Promise<void> {
  const existing = loading.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading.delete(src);
      script.remove();
      reject(new Error(`Chargement impossible : ${src}`));
    };
    document.head.appendChild(script);
  });
  loading.set(src, promise);
  return promise;
}

export const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';
export const GAPI_SCRIPT = 'https://apis.google.com/js/api.js';
