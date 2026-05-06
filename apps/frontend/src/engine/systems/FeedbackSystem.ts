import { CAMERA, TIMING } from '../constants.js';
import type { HitQuality } from '../events/EventBus.js';
import type { OutcomeBucket } from '../rng/OutcomeSystem.js';

// ── Data types ────────────────────────────────────────────────────────────────

export interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** 1 = just spawned, 0 = expired. Decays each frame. */
  life: number;
  lifespan: number;   // total lifespan in seconds
  size: number;
  color: number;      // 0xRRGGBB
}

export interface FeedbackState {
  /** Shake magnitude; decays toward 0 automatically each frame. */
  shakeIntensity: number;
  /** Per-frame screen-space shake offset applied by Camera. */
  shakeOffset: { x: number; y: number; z: number };
  /**
   * Remaining seconds of hit-pause.
   * While > 0 the GameEngine passes physicsDt = 0 to ball/physics systems.
   */
  pauseRemaining: number;
  /** Live particle list. Renderer reads this to draw burst effects. */
  particles: Particle[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PARTICLE_LIFESPAN = 1.1;  // seconds
const BURST_COUNT: Record<HitQuality, number> = {
  perfect: 28,
  good:    14,
  miss:    4,
};
const BURST_COLOR: Record<HitQuality, number> = {
  perfect: 0xFFD700,  // gold
  good:    0xFF8C00,  // orange
  miss:    0xDD2222,  // dull red
};

// ── Factory ───────────────────────────────────────────────────────────────────

export function makeFeedbackState(): FeedbackState {
  return {
    shakeIntensity: 0,
    shakeOffset:    { x: 0, y: 0, z: 0 },
    pauseRemaining: 0,
    particles:      [],
  };
}

// ── FeedbackSystem ────────────────────────────────────────────────────────────
//
// No Three.js, no camera references, no setTimeout.
// All effects are dt-based and driven by FeedbackState.
// The Camera and Renderer read this state to apply offsets / draw particles.

export class FeedbackSystem {
  update(state: FeedbackState, dt: number): void {
    // ── Shake decay ───────────────────────────────────────────────────────────
    if (state.shakeIntensity > 0) {
      state.shakeIntensity = Math.max(0, state.shakeIntensity - CAMERA.SHAKE_DECAY * dt);
      const i = state.shakeIntensity;
      state.shakeOffset.x = (Math.random() - 0.5) * i * 2;
      state.shakeOffset.y = (Math.random() - 0.5) * i;
      state.shakeOffset.z = (Math.random() - 0.5) * i * 0.5;
    } else {
      state.shakeOffset.x = 0;
      state.shakeOffset.y = 0;
      state.shakeOffset.z = 0;
    }

    // ── Hit-pause countdown ───────────────────────────────────────────────────
    if (state.pauseRemaining > 0) {
      state.pauseRemaining = Math.max(0, state.pauseRemaining - dt);
    }

    // ── Particle physics ──────────────────────────────────────────────────────
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt / p.lifespan;
      if (p.life <= 0) { state.particles.splice(i, 1); continue; }
      // Gravity-affected burst
      p.vy -= 9.8 * dt * 0.4;
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.z  += p.vz * dt;
    }
  }

  /** Called immediately when a swing resolves. No delays. */
  triggerHit(
    state: FeedbackState,
    quality: HitQuality,
    bucket: OutcomeBucket,
    hitPos: { x: number; y: number; z: number },
  ): void {
    const bucketBoost = bucket === 'six' ? 0.2 : bucket === 'four' ? 0.1 : bucket === 'wicket' ? 0.12 : 0;
    state.shakeIntensity  = (quality === 'perfect' ? 0.45
                          : quality === 'good'    ? 0.22
                          : 0.06) + bucketBoost;
    state.pauseRemaining  = quality !== 'miss' ? Math.min(0.05, TIMING.HIT_PAUSE) : 0;

    this.spawnBurst(state, hitPos, quality);
    if (bucket === 'four' || bucket === 'six') {
      this.spawnBurst(state, hitPos, 'perfect');
    } else if (bucket === 'wicket') {
      this.spawnBurst(state, hitPos, 'miss');
      this.spawnBurst(state, { x: hitPos.x, y: hitPos.y + 0.15, z: hitPos.z }, 'miss');
    }
  }

  /** Mid-air sky-object impact: burst + micro shake + ~0.1s hit-stop (additive). */
  triggerSkyObjectImpact(
    state: FeedbackState,
    pos: { x: number; y: number; z: number },
  ): void {
    this.spawnBurst(state, pos, 'perfect');
    this.spawnBurst(state, { x: pos.x, y: pos.y + 0.35, z: pos.z }, 'perfect');
    state.shakeIntensity = Math.max(state.shakeIntensity, 0.18);
    state.pauseRemaining = Math.max(state.pauseRemaining, 0.1);
  }

  /** @returns True while hit-pause is active. Callers should zero physicsDt. */
  isPaused(state: FeedbackState): boolean {
    return state.pauseRemaining > 0;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private spawnBurst(
    state:   FeedbackState,
    pos:     { x: number; y: number; z: number },
    quality: HitQuality,
  ): void {
    const count = BURST_COUNT[quality];
    const color = BURST_COLOR[quality];

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI;
      const spd   = 3 + Math.random() * 5;
      state.particles.push({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.sin(phi) * Math.cos(theta) * spd,
        vy: Math.abs(Math.cos(phi))          * spd,
        vz: Math.sin(phi) * Math.sin(theta) * spd,
        life:     1,
        lifespan: PARTICLE_LIFESPAN * (0.6 + Math.random() * 0.8),
        size:     0.05 + Math.random() * 0.07,
        color,
      });
    }
  }
}
