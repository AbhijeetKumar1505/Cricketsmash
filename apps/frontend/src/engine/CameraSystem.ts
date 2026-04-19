import * as THREE from 'three';
import gsap from 'gsap';
import { StadiumCameraRig } from './camera.js';
import { POVSystem } from './POVSystem.js';
import { triggerHardwareShake } from './arena/cameraEffects.js';
import type { EngineProps } from './CricketWebGLEngine.js';

/**
 * CameraSystem — thin orchestration layer over POVSystem.
 * Delegates all cinematic transitions to POVSystem and handles
 * impact shake (which targets rig.group — a separate object from
 * rig.camera, so there's no GSAP conflict).
 */
export class CameraSystem {
  private rig: StadiumCameraRig;
  private pov: POVSystem;
  private prevPhase = '';

  constructor(rig: StadiumCameraRig) {
    this.rig = rig;
    this.pov = new POVSystem(rig);
  }

  // No-op: POVSystem drives all perspective transitions automatically
  setPerspective(_perspective?: string) {}

  update(dt: number, time: number, props: EngineProps, ballWorld: THREE.Vector3) {
    // Handheld atmospheric drift — applied to group so it's orthogonal to GSAP camera anims
    this.rig.group.position.x = Math.sin(time * 0.4) * 0.08;
    this.rig.group.position.y = Math.cos(time * 0.32) * 0.08;

    // Impact shake on phase transitions
    const ph = props.phase;
    if (ph !== this.prevPhase) {
      if (ph === 'hit') {
        triggerHardwareShake(this.rig, props.hitTrajectory === 'six' ? 'heavy' : 'mild');
      } else if (ph === 'wicket') {
        triggerHardwareShake(this.rig, 'heavy');
      }
      this.prevPhase = ph;
    }

    this.pov.update(
      props.phase,
      props.multiplier,
      ballWorld,
      props.hitTrajectory,
      dt,
      props.deliveryKey,
    );
  }

  dispose() {
    this.pov.dispose();
    gsap.killTweensOf(this.rig.camera.position);
    gsap.killTweensOf(this.rig.group.position);
  }
}
