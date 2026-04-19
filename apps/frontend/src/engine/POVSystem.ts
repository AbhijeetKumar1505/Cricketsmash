import * as THREE from 'three';
import gsap from 'gsap';
import type { StadiumCameraRig } from './camera.js';
import type { SimPhase } from './physics/ballTrajectory.js';

type FixedPOV = Exclude<AutoPOVMode, 'ball_follow'>;

export type AutoPOVMode =
  | 'broadcast'
  | 'bowler_runup'
  | 'batsman_facing'
  | 'ball_follow'
  | 'crowd'
  | 'umpire'
  | 'impact_six'
  | 'impact_four'
  | 'impact_wicket';

interface POVConfig {
  pos:  [number, number, number];
  look: [number, number, number];
  fov:  number;
  dur:  number;
  ease: string;
}

// World-space positions. Pitch runs along Z: bowler≈+10, batsman≈-10.
// Camera broadcast sits at Z=22, looking inward toward origin.
const CONFIGS: Record<FixedPOV, POVConfig> = {
  broadcast:      { pos: [ 0,    9.0,  22], look: [ 0,  1.2,   0 ], fov: 40, dur: 1.2,  ease: 'power2.inOut' },
  bowler_runup:   { pos: [ 0,    2.5,  16], look: [ 0,  1.5,  -8 ], fov: 52, dur: 0.65, ease: 'power2.out'   },
  batsman_facing: { pos: [ 0.5,  2.2,  -9], look: [ 0,  1.8,  12 ], fov: 58, dur: 0.45, ease: 'power3.out'   },
  crowd:          { pos: [22,    6.0,   4], look: [ 0,  1.5,   0 ], fov: 44, dur: 0.85, ease: 'power2.inOut' },
  umpire:         { pos: [ 0.8,  3.5,  12], look: [ 0,  0.8,  -8 ], fov: 55, dur: 0.5,  ease: 'power2.out'   },
  impact_six:     { pos: [-14,   7.0,  -6], look: [ 0,  3.0, -18 ], fov: 42, dur: 0.28, ease: 'power4.out'   },
  impact_four:    { pos: [10,    4.0, -18], look: [ 0,  1.5, -10 ], fov: 45, dur: 0.28, ease: 'power4.out'   },
  impact_wicket:  { pos: [ 0.8,  2.5,  14], look: [ 0,  0.6,  -8 ], fov: 48, dur: 0.22, ease: 'power4.in'    },
};

// Multiple crowd angles so repeated sixes don't look identical.
// Selected deterministically from deliveryKey.
const CROWD_ALTS: POVConfig[] = [
  { pos: [ 22,  6.0,   4], look: [0, 1.5,  0], fov: 44, dur: 0.85, ease: 'power2.inOut' },
  { pos: [-18,  7.5,  -8], look: [0, 2.0,  0], fov: 40, dur: 0.85, ease: 'power2.inOut' },
  { pos: [  0, 15.0,   2], look: [0, 0.0,  0], fov: 52, dur: 1.0,  ease: 'power2.inOut' },
  { pos: [ 14,  5.0,  18], look: [0, 1.8,  0], fov: 46, dur: 0.85, ease: 'power2.inOut' },
];

/**
 * POVSystem — Cinematic camera director.
 *
 * Owns all camera position / lookAt / FOV transitions. Phase transitions trigger
 * POV cuts; ball_follow mode orbits the camera behind the ball in real-time.
 * Shake effects (triggerHardwareShake) operate on rig.group.position — fully
 * compatible since they target a different object.
 */
export class POVSystem {
  private rig: StadiumCameraRig;
  private mode: AutoPOVMode = 'broadcast';
  private prevPhase: SimPhase | '' = '';
  private deliveryKey = 0;
  private cancelFn: (() => void) | null = null;

  constructor(rig: StadiumCameraRig) {
    this.rig = rig;
    this.moveTo('broadcast', false);
  }

  update(
    phase: SimPhase,
    mult: number,
    ballWorld: THREE.Vector3,
    traj: 'six' | 'four' | 'neutral',
    dt: number,
    deliveryKey = 0,
  ): void {
    this.deliveryKey = deliveryKey;

    if (phase !== this.prevPhase) {
      this.prevPhase = phase;
      this.cancel();

      switch (phase) {
        case 'idle':
          this.moveTo('broadcast');
          break;

        case 'celebrate':
          this.moveTo('broadcast');
          break;

        case 'bowl': {
          this.moveTo('bowler_runup');
          // Mid-delivery: cut to batsman facing the bowler
          const t1 = gsap.delayedCall(0.65, () => {
            if (this.prevPhase === 'bowl') this.moveTo('batsman_facing');
          });
          this.cancelFn = () => t1.kill();
          break;
        }

        case 'hit': {
          // Lens breath — FOV punch on impact
          gsap.killTweensOf(this.rig.camera);
          gsap.to(this.rig.camera, {
            fov: 68,
            duration: 0.07,
            ease: 'power4.out',
            onUpdate: () => this.rig.camera.updateProjectionMatrix(),
            onComplete: () => {
              gsap.to(this.rig.camera, {
                fov: 58,
                duration: 0.38,
                ease: 'power2.inOut',
                onUpdate: () => this.rig.camera.updateProjectionMatrix(),
              });
            },
          });

          // Immediately chase the ball
          this.mode = 'ball_follow';
          gsap.killTweensOf(this.rig.camera.position);
          gsap.killTweensOf(this.rig.lookAtTarget);

          // After ball travels, cut to a dramatic reaction angle
          const delay = traj === 'six' ? 1.4 : traj === 'four' ? 1.1 : 0.9;
          const t2 = gsap.delayedCall(delay, () => {
            if (this.prevPhase !== 'hit') return;
            if (traj === 'six') {
              const crowdCfg = CROWD_ALTS[this.deliveryKey % CROWD_ALTS.length]!;
              this.moveToConfig(mult >= 4 ? crowdCfg : CONFIGS.impact_six);
            } else if (traj === 'four') {
              this.moveTo('impact_four');
            } else {
              this.moveTo('broadcast');
            }
          });
          this.cancelFn = () => t2.kill();
          break;
        }

        case 'wicket': {
          // Snap to tight bowler-end angle, then umpire signal
          this.moveTo('impact_wicket');
          const t3 = gsap.delayedCall(0.75, () => {
            if (this.prevPhase === 'wicket') this.moveTo('umpire');
          });
          this.cancelFn = () => t3.kill();
          break;
        }
      }
    }

    if (this.mode === 'ball_follow') {
      this.chaseBall(ballWorld, mult, dt);
    }
  }

  private moveTo(mode: FixedPOV, animate = true): void {
    this.moveToConfig(CONFIGS[mode], animate);
    this.mode = mode;
  }

  private moveToConfig(c: POVConfig, animate = true): void {
    gsap.killTweensOf(this.rig.camera.position);
    gsap.killTweensOf(this.rig.lookAtTarget);
    gsap.killTweensOf(this.rig.camera);

    if (animate) {
      gsap.to(this.rig.camera.position, {
        x: c.pos[0], y: c.pos[1], z: c.pos[2],
        duration: c.dur, ease: c.ease,
      });
      gsap.to(this.rig.lookAtTarget, {
        x: c.look[0], y: c.look[1], z: c.look[2],
        duration: c.dur, ease: c.ease,
      });
      gsap.to(this.rig.camera, {
        fov: c.fov,
        duration: c.dur,
        ease: c.ease,
        onUpdate: () => this.rig.camera.updateProjectionMatrix(),
      });
    } else {
      this.rig.camera.position.set(...c.pos);
      this.rig.lookAtTarget.set(...c.look);
      this.rig.camera.fov = c.fov;
      this.rig.camera.updateProjectionMatrix();
    }
  }

  // Orbit-style chase — stays behind ball's travel direction, rises with multiplier
  private chaseBall(ball: THREE.Vector3, mult: number, dt: number): void {
    const radius = 9.5 + mult * 0.38;
    const elevation = ball.y + 3.0 + Math.min(3.5, mult * 0.1);

    // Ball travels in -Z direction; camera stays at +Z offset (behind, from bowler's end)
    const targetPos = new THREE.Vector3(
      ball.x * 0.22,
      elevation,
      ball.z + radius,
    );
    this.rig.camera.position.lerp(targetPos, Math.min(1, dt * 3.5));

    const targetLook = new THREE.Vector3(ball.x * 0.45, ball.y + 0.45, ball.z);
    this.rig.lookAtTarget.lerp(targetLook, Math.min(1, dt * 4.2));
  }

  private cancel(): void {
    this.cancelFn?.();
    this.cancelFn = null;
  }

  dispose(): void {
    this.cancel();
    gsap.killTweensOf(this.rig.camera.position);
    gsap.killTweensOf(this.rig.lookAtTarget);
    gsap.killTweensOf(this.rig.camera);
  }
}
