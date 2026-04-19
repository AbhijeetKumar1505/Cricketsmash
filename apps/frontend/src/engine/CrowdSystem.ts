import { SpectatorSystem } from './arena/spectators.js';
import type { EngineProps } from './CricketWebGLEngine.js';

export class CrowdSystem {
  private spectators: SpectatorSystem;

  constructor(scene: import('three').Scene) {
    this.spectators = new SpectatorSystem();
    scene.add(this.spectators.group);
  }

  update(dt: number, _time: number, props: EngineProps) {
    const ph = props.phase;
    const mult = props.multiplier;

    // Excitement ramps up with multiplier during active play, drops off otherwise
    const rawExcitement = ph === 'hit' || ph === 'bowl'
      ? Math.min(1, (mult - 1) / 8)
      : ph === 'wicket' || ph === 'celebrate'
        ? 0.85
        : 0.05;

    this.spectators.setExcitement(rawExcitement);
    this.spectators.update(dt);
  }

  dispose() {}
}
