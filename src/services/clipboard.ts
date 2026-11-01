export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Partage un lien : partage natif sur mobile, sinon copie dans le presse-papiers (F28). */
export async function shareLink(url: string, title: string): Promise<ShareOutcome> {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (coarse && typeof navigator.share === 'function') {
    try {
      await navigator.share({ url, title });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
