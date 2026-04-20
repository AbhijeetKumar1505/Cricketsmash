import { SpectatorSystem } from './arena/spectators.js';
import { StadiumActivitySystem } from './arena/stadiumActivities.js';
import type { EngineProps } from './CricketWebGLEngine.js';
import * as Audio from '../lib/gameAudio.js';

/**
 * CrowdSystem — bridges EngineProps phase transitions to spectator crowd reactions,
 * stadium tech effects, and synthesized crowd audio.
 */
export class CrowdSystem {
  private spectators: SpectatorSystem;
  private activities: StadiumActivitySystem;
  private prevPhase: string = 'idle';
  private prevTrajectory: string = 'neutral';
  private audioInitialized = false;

  constructor(scene: import('three').Scene) {
    this.spectators = new SpectatorSystem();
    this.activities = new StadiumActivitySystem();
    scene.add(this.spectators.group);
    scene.add(this.activities.group);
  }

  update(dt: number, _time: number, props: EngineProps) {
    const ph = props.phase;
    const mult = props.multiplier;
    const traj = props.hitTrajectory;

    if (!this.audioInitialized) {
      Audio.startCrowdMurmur();
      this.audioInitialized = true;
    }

    // ── Excitement ramps with multiplier ──
    const rawExcitement = Math.min(1, (mult - 1) / 8);
    this.spectators.setExcitement(rawExcitement);
    this.activities.setExcitement(rawExcitement);
    Audio.updateCrowdHype(Math.max(rawExcitement, ph === 'celebrate' ? 0.8 : 0));

    // ── Detect phase transitions ──
    if (ph !== this.prevPhase) {
      this.onPhaseChange(ph, traj);
      this.prevPhase = ph;
    }

    // ── Detect trajectory change (new boundary hit) ──
    if (ph === 'hit' && traj !== this.prevTrajectory) {
      this.onHitTrajectoryChange(traj);
      this.prevTrajectory = traj;
    }

    this.spectators.update(dt);
    this.activities.update(dt);
  }

  private onPhaseChange(phase: string, traj: string) {
    switch (phase) {
      case 'bowl':
        this.spectators.setState('engaged');
        this.spectators.triggerReaction('jump');
        Audio.playCrowdShout(0.4);
        break;

      case 'hit':
        this.onHitTrajectoryChange(traj);
        break;

      case 'wicket':
        this.spectators.setState('shocked');
        this.spectators.triggerReaction('dismay');
        Audio.playCrowdGroan();
        break;

      case 'celebrate':
        this.spectators.setState('celebration');
        this.spectators.triggerMexicanWave();
        this.activities.triggerSpotlightSweep();
        this.activities.triggerLasers();
        Audio.playCrowdShout(0.85);
        break;

      case 'idle':
      default:
        this.spectators.setState('idle');
        this.spectators.triggerReaction('settle');
        break;
    }
  }

  private onHitTrajectoryChange(traj: string) {
    if (traj === 'six') {
      this.spectators.setState('hyped');
      this.spectators.triggerReaction('jump');
      this.spectators.triggerDirectionalWave('radial'); 
      this.activities.triggerConfetti();
      this.activities.triggerLasers();
      Audio.playCrowdShout(1.0);
      Audio.playCrowdSwell('boundary');
    } else if (traj === 'four') {
      this.spectators.setState('hyped');
      this.spectators.triggerReaction('clap');
      Audio.playCrowdShout(0.75);
      Audio.playCrowdSwell('boundary');
    } else if (traj === 'out') {
        // Handled by phase 'wicket' or 'out'
    } else {
      this.spectators.setState('engaged');
      this.spectators.triggerReaction('clap');
      Audio.playCrowdShout(0.5);
    }
  }

  dispose() {
    this.activities.dispose();
  }
}
