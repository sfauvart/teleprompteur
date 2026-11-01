import { describe, expect, it } from 'vitest';
import { ScrollEngine, anchorAt, positionOf, type Layout } from './scrollEngine';

/** Horloge et images simulées : `advance(ms)` exécute les images par pas de 16 ms. */
function fakeFrames() {
  let time = 0;
  let nextId = 1;
  const callbacks = new Map<number, (t: number) => void>();
  return {
    now: () => time,
    requestFrame: (cb: (t: number) => void) => {
      const id = nextId++;
      callbacks.set(id, cb);
      return id;
    },
    cancelFrame: (id: number) => callbacks.delete(id),
    /** Une seule image après une absence de `ms` (onglet masqué). */
    jump(ms: number) {
      time += ms;
      const pending = [...callbacks.entries()];
      callbacks.clear();
      for (const [, cb] of pending) cb(time);
    },
    advance(ms: number) {
      const end = time + ms;
      while (time < end) {
        time = Math.min(end, time + 16);
        const pending = [...callbacks.entries()];
        callbacks.clear();
        for (const [, cb] of pending) cb(time);
      }
    },
  };
}

const layout = (heights: number[], gap = 0): Layout => {
  const tops: number[] = [];
  let y = 0;
  for (const h of heights) {
    tops.push(y);
    y += h + gap;
  }
  return { tops, heights, distance: y - gap };
};

function setup() {
  const frames = fakeFrames();
  const engine = new ScrollEngine(frames);
  const content = document.createElement('div');
  engine.attach(content);
  engine.setSurfaceHeight(1000);
  return { frames, engine, content };
}

describe('anchorAt / positionOf', () => {
  const l = layout([100, 200, 100]);

  it('trouve le bloc et la fraction', () => {
    expect(anchorAt(l, 0)).toEqual({ blockIndex: 0, fraction: 0 });
    expect(anchorAt(l, 200)).toEqual({ blockIndex: 1, fraction: 0.5 });
    expect(anchorAt(l, 400)).toEqual({ blockIndex: 2, fraction: 1 });
  });

  it('restitue la position', () => {
    expect(positionOf(l, { blockIndex: 1, fraction: 0.5 })).toBe(200);
    expect(positionOf(l, { blockIndex: 9, fraction: 0 })).toBe(400);
  });
});

describe('ScrollEngine', () => {
  it('positionne le début du texte à 35 % de la surface', () => {
    const { engine, content } = setup();
    engine.setLayout(layout([500]));
    expect(content.style.transform).toBe('translate3d(0, 350px, 0)');
  });

  it('défile à la vitesse demandée', () => {
    const { engine, frames } = setup();
    engine.setLayout(layout([5000]));
    engine.setSpeed(100);
    engine.play();
    frames.advance(2000);
    expect(engine.getPosition()).toBeGreaterThan(195);
    expect(engine.getPosition()).toBeLessThanOrEqual(200);
    expect(engine.getSnapshot()).toMatchObject({ state: 'playing', elapsedSec: 1 });
  });

  it('se fige en pause et reprend depuis la position courante', () => {
    const { engine, frames } = setup();
    engine.setLayout(layout([5000]));
    engine.setSpeed(100);
    engine.play();
    frames.advance(1000);
    engine.pause();
    const paused = engine.getPosition();
    frames.advance(1000);
    expect(engine.getPosition()).toBe(paused);
    engine.play();
    frames.advance(1000);
    expect(engine.getPosition()).toBeGreaterThan(paused + 90);
  });

  it('plafonne le pas de temps (onglet masqué)', () => {
    const { engine, frames } = setup();
    engine.setLayout(layout([5000]));
    engine.setSpeed(100);
    engine.play();
    frames.advance(16);
    const before = engine.getPosition();
    frames.jump(5000);
    // Au plus 100 ms prises en compte : 10 px à 100 px/s.
    expect(engine.getPosition() - before).toBeCloseTo(10);
  });

  it('s’arrête en fin de texte et prévient', () => {
    const { engine, frames } = setup();
    let ended = 0;
    engine.onEnd(() => ended++);
    engine.setLayout(layout([100]));
    engine.setSpeed(200);
    engine.play();
    frames.advance(1000);
    expect(engine.getSnapshot().state).toBe('ended');
    expect(engine.getPosition()).toBe(100);
    expect(ended).toBe(1);
    engine.play();
    expect(engine.getPosition()).toBe(0);
  });

  it('Stop revient au début', () => {
    const { engine, frames } = setup();
    engine.setLayout(layout([5000]));
    engine.play();
    frames.advance(1000);
    engine.stop();
    expect(engine.getPosition()).toBe(0);
    expect(engine.getSnapshot()).toMatchObject({ state: 'idle', elapsedSec: 0 });
  });

  it('conserve la ligne lue quand la mise en page change', () => {
    const { engine } = setup();
    engine.setLayout(layout([100, 200, 100]));
    engine.nudge(200); // milieu du 2e bloc
    engine.setLayout(layout([200, 400, 200])); // texte deux fois plus grand
    expect(engine.getPosition()).toBe(400);
  });

  it('un déplacement manuel depuis l’arrêt passe en pause', () => {
    const { engine } = setup();
    engine.setLayout(layout([1000]));
    engine.nudge(300);
    expect(engine.getSnapshot().state).toBe('paused');
    engine.nudge(-1000);
    expect(engine.getPosition()).toBe(0);
  });

  it('saute de paragraphe en paragraphe', () => {
    const { engine, frames } = setup();
    engine.setLayout(layout([100, 50, 100, 100]));
    const isParagraph = (i: number) => i !== 1;
    engine.jumpBlock(1, isParagraph);
    frames.advance(300);
    expect(engine.getPosition()).toBe(150);
    engine.jumpBlock(1, isParagraph);
    frames.advance(300);
    expect(engine.getPosition()).toBe(250);
    engine.jumpBlock(-1, isParagraph);
    frames.advance(300);
    expect(engine.getPosition()).toBe(150);
  });

  it('restaure une position mémorisée dès que la mise en page est connue', () => {
    const { engine } = setup();
    engine.seekToAnchor({ blockIndex: 1, fraction: 0.5 });
    engine.setLayout(layout([100, 200]));
    expect(engine.getPosition()).toBe(200);
    expect(engine.getSnapshot().state).toBe('paused');
  });

  it('suit la ligne de départ et met à jour la barre de progression', () => {
    const { engine, content } = setup();
    const bar = document.createElement('div');
    engine.attachProgress(bar);
    engine.setLayout(layout([1000]));
    engine.setStartRatio(0.5);
    expect(content.style.transform).toBe('translate3d(0, 500px, 0)');
    engine.nudge(250);
    expect(bar.style.transform).toBe('scaleX(0.25)');
  });
});
