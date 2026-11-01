import { clamp } from '../../../domain/settings';

export type EngineState = 'idle' | 'playing' | 'paused' | 'ended';

/** Mise en page du contenu : position et hauteur de chaque bloc, hauteur totale (px). */
export interface Layout {
  tops: number[];
  heights: number[];
  distance: number;
}

/** Position exprimée par rapport aux blocs : résiste aux changements de mise en page. */
export interface Anchor {
  blockIndex: number;
  fraction: number;
}

export interface EngineSnapshot {
  state: EngineState;
  /** Distance défilée (px). */
  position: number;
  /** Hauteur totale à faire défiler (px). */
  distance: number;
  /** Vitesse effective (px/s). */
  pixelsPerSecond: number;
  /** Temps écoulé, en secondes entières. */
  elapsedSec: number;
}

export const EMPTY_LAYOUT: Layout = { tops: [], heights: [], distance: 0 };

/** Bloc situé à la hauteur `position` et fraction de ce bloc déjà défilée (spec technique §7.6). */
export function anchorAt(layout: Layout, position: number): Anchor | null {
  const { tops, heights } = layout;
  if (tops.length === 0) return null;
  let index = 0;
  while (index + 1 < tops.length && (tops[index + 1] ?? Infinity) <= position) index++;
  const top = tops[index] ?? 0;
  const height = heights[index] ?? 0;
  const fraction = height > 0 ? clamp((position - top) / height, 0, 1) : 0;
  return { blockIndex: index, fraction };
}

export function positionOf(layout: Layout, anchor: Anchor): number {
  const top = layout.tops[anchor.blockIndex];
  if (top === undefined) return layout.distance;
  return top + anchor.fraction * (layout.heights[anchor.blockIndex] ?? 0);
}

/** Proportion de la hauteur de la surface où commence le texte (par défaut : haut de la zone de lecture). */
export const START_RATIO = 0.35;
const MAX_FRAME_DELTA_MS = 100;
const SEEK_DURATION_MS = 250;

export interface ScrollEngineOptions {
  now?: () => number;
  requestFrame?: (callback: (time: number) => void) => number;
  cancelFrame?: (id: number) => void;
}

/**
 * Moteur de défilement (spec technique §7) : impératif et indépendant de React, il applique
 * directement le `transform` sur l'élément de contenu à chaque image.
 */
export class ScrollEngine {
  private state: EngineState = 'idle';
  private position = 0;
  private speed = 48;
  private layout: Layout = EMPTY_LAYOUT;
  private surfaceHeight = 0;
  private content: HTMLElement | null = null;
  private progress: HTMLElement | null = null;
  private startRatio = START_RATIO;
  private endRatio = START_RATIO;
  private frame: number | null = null;
  private lastTime: number | null = null;
  private tween: { from: number; to: number; start: number } | null = null;
  private pendingAnchor: Anchor | null = null;
  private listeners = new Set<() => void>();
  private snapshot: EngineSnapshot;

  private readonly now: () => number;
  private readonly requestFrame: (callback: (time: number) => void) => number;
  private readonly cancelFrame: (id: number) => void;

  private endListeners = new Set<() => void>();

  /** Prévient quand la fin du texte est atteinte en lecture. */
  onEnd(listener: () => void): () => void {
    this.endListeners.add(listener);
    return () => this.endListeners.delete(listener);
  }

  constructor(options: ScrollEngineOptions = {}) {
    this.now = options.now ?? (() => performance.now());
    this.requestFrame = options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
    this.cancelFrame = options.cancelFrame ?? ((id) => cancelAnimationFrame(id));
    this.snapshot = this.buildSnapshot();
  }

  // --- Abonnement (compatible useSyncExternalStore) ---

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): EngineSnapshot => this.snapshot;

  // --- Branchement au DOM et mesures ---

  attach(content: HTMLElement): void {
    this.content = content;
    this.apply();
  }

  detach(): void {
    this.stopLoop();
    this.content = null;
    this.progress = null;
  }

  /** Barre de progression (F42) : mise à jour à chaque image, sans passer par React. */
  attachProgress(element: HTMLElement | null): void {
    this.progress = element;
    this.apply();
  }

  /** Position de la ligne de départ, en fraction de la hauteur de la surface. */
  setStartRatio(ratio: number): void {
    this.startRatio = ratio;
    this.apply();
  }

  /**
   * Ligne de fin, en fraction de la hauteur : la lecture s'arrête quand le bas du texte l'atteint
   * (haut de la zone de lecture). Si elle est au-dessus de la ligne de départ, le texte défile
   * d'autant plus loin que sa hauteur.
   */
  setEndRatio(ratio: number): void {
    this.endRatio = ratio;
    this.apply();
  }

  /** Distance totale de défilement : hauteur du texte + trajet de la ligne de départ à la fin. */
  private scrollLimit(): number {
    return this.layout.distance + Math.max(0, this.startRatio - this.endRatio) * this.surfaceHeight;
  }

  /** Va à une fraction (0–1) du texte, avec animation (clic sur la barre de progression). */
  seekFraction(fraction: number): void {
    this.seek(clamp(fraction, 0, 1) * this.scrollLimit());
  }

  setSurfaceHeight(height: number): void {
    this.surfaceHeight = height;
    this.apply();
  }

  /** Nouvelle mise en page : la ligne en cours de lecture est conservée (ancrage §7.6). */
  setLayout(layout: Layout): void {
    const restoring = this.pendingAnchor !== null;
    const anchor =
      this.pendingAnchor ?? (this.position > 0 ? anchorAt(this.layout, this.position) : null);
    this.pendingAnchor = null;
    this.layout = layout;
    this.tween = null;
    if (anchor) this.position = positionOf(layout, anchor);
    this.position = clamp(this.position, 0, this.scrollLimit());
    if (restoring) this.afterManualMove(this.position);
    this.apply();
    this.notify(true);
  }

  /** Position à restaurer (reprise de lecture), appliquée dès que la mise en page est connue. */
  seekToAnchor(anchor: Anchor): void {
    if (this.layout.tops.length > 0) this.moveTo(positionOf(this.layout, anchor));
    else this.pendingAnchor = anchor;
  }

  currentAnchor(): Anchor | null {
    return anchorAt(this.layout, this.position);
  }

  getLayout(): Layout {
    return this.layout;
  }

  setSpeed(pixelsPerSecond: number): void {
    this.speed = Math.max(0.1, pixelsPerSecond);
    this.notify(true);
  }

  // --- Commandes ---

  play(): void {
    if (this.state === 'playing') return;
    if (this.state === 'ended') this.position = 0;
    this.state = 'playing';
    this.startLoop();
    this.notify(true);
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    if (!this.tween) this.stopLoop();
    this.notify(true);
  }

  toggle(): void {
    if (this.state === 'playing') this.pause();
    else this.play();
  }

  stop(): void {
    this.state = 'idle';
    this.position = 0;
    this.tween = null;
    this.stopLoop();
    this.apply();
    this.notify(true);
  }

  /** Déplacement manuel immédiat (molette, glisser). */
  nudge(delta: number): void {
    this.tween = null;
    this.moveTo(this.position + delta);
  }

  /** Déplacement animé (Page ↑/↓, sauts de paragraphe). */
  seek(target: number): void {
    const to = clamp(target, 0, this.scrollLimit());
    this.tween = { from: this.position, to, start: this.now() };
    this.afterManualMove(to);
    this.startLoop();
  }

  /** Avance (+1) ou recule (−1) d'une page : 80 % de la hauteur de la surface. */
  page(direction: 1 | -1): void {
    this.seek(this.targetPosition() + direction * 0.8 * this.surfaceHeight);
  }

  /** Saute au début du bloc suivant / précédent parmi ceux acceptés par `isTarget`. */
  jumpBlock(direction: 1 | -1, isTarget: (index: number) => boolean): void {
    const { tops } = this.layout;
    const from = this.targetPosition();
    const current = anchorAt(this.layout, from)?.blockIndex ?? 0;
    if (direction === 1) {
      for (let i = current + 1; i < tops.length; i++) {
        if (isTarget(i)) return this.seek(tops[i] ?? 0);
      }
      return this.seek(this.scrollLimit());
    }
    for (let i = current; i >= 0; i--) {
      const top = tops[i] ?? 0;
      if (isTarget(i) && top < from - 2) return this.seek(top);
    }
    this.seek(0);
  }

  // --- Interne ---

  private targetPosition(): number {
    return this.tween ? this.tween.to : this.position;
  }

  private moveTo(target: number): void {
    this.position = clamp(target, 0, this.scrollLimit());
    this.afterManualMove(this.position);
    this.apply();
    this.notify(false);
  }

  /** Après un déplacement manuel, un texte arrêté devient « en pause » pour reprendre de là. */
  private afterManualMove(target: number): void {
    if (
      (this.state === 'idle' || this.state === 'ended') &&
      target > 0 &&
      target < this.scrollLimit()
    ) {
      this.state = 'paused';
      this.notify(true);
    }
  }

  private startLoop(): void {
    if (this.frame !== null) return;
    this.lastTime = null;
    this.frame = this.requestFrame(this.tick);
  }

  private stopLoop(): void {
    if (this.frame !== null) this.cancelFrame(this.frame);
    this.frame = null;
    this.lastTime = null;
  }

  private tick = (time: number): void => {
    this.frame = null;
    const delta = this.lastTime === null ? 0 : Math.min(time - this.lastTime, MAX_FRAME_DELTA_MS);
    this.lastTime = time;

    if (this.tween) {
      const t = clamp((this.now() - this.tween.start) / SEEK_DURATION_MS, 0, 1);
      const eased = 1 - (1 - t) ** 3;
      this.position = this.tween.from + (this.tween.to - this.tween.from) * eased;
      if (t >= 1) {
        this.tween = null;
        this.apply();
        this.notify(true);
      }
    } else if (this.state === 'playing') {
      this.position += (this.speed * delta) / 1000;
    }

    if (this.state === 'playing' && !this.tween && this.position >= this.scrollLimit()) {
      this.position = this.scrollLimit();
      this.state = 'ended';
      this.apply();
      this.lastTime = null;
      this.notify(true);
      for (const listener of this.endListeners) listener();
      return;
    }

    this.apply();
    this.notify(false);
    if (this.state === 'playing' || this.tween) this.frame = this.requestFrame(this.tick);
    else this.lastTime = null;
  };

  private apply(): void {
    if (this.content) {
      const offset = this.startRatio * this.surfaceHeight - this.position;
      this.content.style.transform = `translate3d(0, ${offset}px, 0)`;
    }
    if (this.progress) {
      const ratio = this.scrollLimit() > 0 ? this.position / this.scrollLimit() : 0;
      this.progress.style.transform = `scaleX(${clamp(ratio, 0, 1)})`;
      this.progress.parentElement?.setAttribute(
        'aria-valuenow',
        String(Math.round(clamp(ratio, 0, 1) * 100)),
      );
    }
  }

  private buildSnapshot(): EngineSnapshot {
    return {
      state: this.state,
      position: this.position,
      distance: this.layout.distance,
      pixelsPerSecond: this.speed,
      elapsedSec: Math.floor(this.position / this.speed),
    };
  }

  /**
   * Notifie les abonnés si l'état change ou si la seconde affichée change :
   * pas de re-rendu React à chaque image (spec technique §7.3). La position exacte
   * reste disponible via `getPosition()`.
   */
  private notify(force: boolean): void {
    const next = this.buildSnapshot();
    const previous = this.snapshot;
    if (!force && next.state === previous.state && next.elapsedSec === previous.elapsedSec) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  getPosition(): number {
    return this.position;
  }
}
