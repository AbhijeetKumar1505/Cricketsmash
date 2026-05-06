// ── AnimationSystem ───────────────────────────────────────────────────────────
//
// Pure state management — zero Three.js imports.
// The Renderer reads CharacterAnimState and maps it to mesh transforms.

// ── Data ──────────────────────────────────────────────────────────────────────

export type AnimPhase =
  | 'idle'
  | 'run'        // bowler run-up / batsman pre-swing crouch
  | 'swing'      // active bat swing
  | 'celebrate'  // arms up / jump
  | 'stumped';   // slumped after wicket

export interface CharacterAnimState {
  phase: AnimPhase;

  /** Primary swing angle (radians). Drives bat / bowling-arm rotation. */
  swingAngle:  number;
  swingTarget: number;
  swingVel:    number;   // spring velocity

  /** Body lean forward (radians). Positive = leaning toward ball. */
  bodyLean: number;

  /** Normalised run-up progress 0→1 (bowler only). */
  runT: number;

  /** Idle breathing phase (grows with time, drives vertical oscillation). */
  breathPhase: number;
}

// ── Spring constants ──────────────────────────────────────────────────────────

const SPRING_K     = 35;     // stiffness
const SPRING_DAMP  = 10;     // critical damping coefficient (2√k)
const LEAN_SPEED   = 6;      // lerp speed for body lean (per second)
const BREATH_RATE  = 2.8;    // radians per second

// ── Helpers ───────────────────────────────────────────────────────────────────

function lerpTo(current: number, target: number, speed: number, dt: number): number {
  return current + (target - current) * Math.min(speed * dt, 1);
}

function springStep(
  angle:  number,
  vel:    number,
  target: number,
  dt:     number,
): [angle: number, vel: number] {
  const force   = (target - angle) * SPRING_K - vel * SPRING_DAMP;
  const newVel  = vel   + force * dt;
  const newAngle = angle + newVel  * dt;
  return [newAngle, newVel];
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function makeCharacterAnim(): CharacterAnimState {
  return {
    phase:       'idle',
    swingAngle:  -1.1,   // guard stance (bat down)
    swingTarget: -1.1,
    swingVel:    0,
    bodyLean:    0,
    runT:        0,
    breathPhase: Math.random() * Math.PI * 2,  // randomise phase offset
  };
}

// ── AnimationSystem ───────────────────────────────────────────────────────────

export class AnimationSystem {
  /** Advance all continuous animations by dt. Called every frame. */
  update(anim: CharacterAnimState, dt: number): void {
    anim.breathPhase += BREATH_RATE * dt;

    // Spring-drive swing angle toward target
    const [na, nv] = springStep(anim.swingAngle, anim.swingVel, anim.swingTarget, dt);
    anim.swingAngle = na;
    anim.swingVel   = nv;

    // Decay run progress when not actively running
    if (anim.phase !== 'run') {
      anim.runT = lerpTo(anim.runT, 0, 4, dt);
    }

    // Decay body lean back to neutral
    const leanTarget = anim.phase === 'swing'    ?  0.15
                     : anim.phase === 'stumped'  ? -0.3
                     : 0;
    anim.bodyLean = lerpTo(anim.bodyLean, leanTarget, LEAN_SPEED, dt);
  }

  // ── Triggers ────────────────────────────────────────────────────────────────

  /** Bowler starts run-up / batsman enters pre-swing stance. */
  startBowl(anim: CharacterAnimState): void {
    anim.phase       = 'run';
    anim.runT        = 0;
    anim.swingTarget = -1.1;
  }

  /** Batsman actively hits the ball. */
  triggerSwing(anim: CharacterAnimState): void {
    anim.phase       = 'swing';
    anim.swingTarget =  2.7;  // full follow-through
  }

  /** After swing, settle to an open guard. */
  followThrough(anim: CharacterAnimState): void {
    anim.swingTarget = -0.3;
  }

  /** Celebration on a hit. */
  celebrate(anim: CharacterAnimState): void {
    anim.phase       = 'celebrate';
    anim.swingTarget =  2.0;  // arms raised
  }

  /** Stumped / bowled out. */
  stump(anim: CharacterAnimState): void {
    anim.phase       = 'stumped';
    anim.swingTarget = -1.5;
  }

  /** Full reset — call before a new delivery. */
  reset(anim: CharacterAnimState): void {
    anim.phase       = 'idle';
    anim.swingTarget = -1.1;
    anim.bodyLean    = 0;
    anim.runT        = 0;
  }
}
