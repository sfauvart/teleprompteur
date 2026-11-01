/**
 * Maintien de l'écran allumé pendant la lecture (spec technique §9.2).
 * Sans support de l'API, ne fait rien.
 */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;

  constructor() {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  async acquire(): Promise<void> {
    this.wanted = true;
    await this.request();
  }

  async release(): Promise<void> {
    this.wanted = false;
    const sentinel = this.sentinel;
    this.sentinel = null;
    await sentinel?.release().catch(() => undefined);
  }

  dispose(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    void this.release();
  }

  private async request(): Promise<void> {
    if (!('wakeLock' in navigator) || this.sentinel || document.visibilityState !== 'visible')
      return;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
    } catch {
      // Refus (batterie faible, politique du navigateur) : sans conséquence bloquante.
    }
  }

  /** Le verrou est relâché par le système quand la page est masquée : on le redemande. */
  private onVisibilityChange = (): void => {
    if (this.wanted && document.visibilityState === 'visible') void this.request();
  };
}
