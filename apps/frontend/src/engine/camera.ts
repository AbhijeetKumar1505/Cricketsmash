import * as THREE from 'three';
import gsap from 'gsap';

export interface StadiumCameraState {
  basePos: THREE.Vector3;
  target: THREE.Vector3;
}

export type CameraPerspective = 'broadcast' | 'bowler' | 'batsman';

/**
 * Broadcast-style camera rig: default stadium angle, dynamic follow, shake, wicket zoom.
 * All motion is time-based via GSAP.
 *
 * lookAtTarget is a shared Vector3 animated by GSAP and read every frame by the engine
 * render loop via camera.lookAt(rig.lookAtTarget). This is the single source of truth
 * for the camera's aim — GSAP tweens must NOT call camera.lookAt() directly, since the
 * render loop always wins.
 */
export class StadiumCameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly group: THREE.Group;
  /** Animated by GSAP; the engine render loop calls camera.lookAt(this.lookAtTarget) each frame. */
  readonly lookAtTarget = new THREE.Vector3(0, 1.2, 0);
  private basePosition: THREE.Vector3;
  private currentPerspective: CameraPerspective = 'broadcast';
  private shakeTween: gsap.core.Timeline | null = null;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.basePosition = new THREE.Vector3(0, 9, 22);
    this.camera.position.copy(this.basePosition);
    this.camera.lookAt(this.lookAtTarget);
    this.group.add(this.camera);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  reset(duration = 0.85) {
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.group.position);
    gsap.killTweensOf(this.lookAtTarget);
    gsap.to(this.camera.position, {
      x: this.basePosition.x,
      y: this.basePosition.y,
      z: this.basePosition.z,
      duration,
      ease: 'power2.inOut',
    });
    gsap.to(this.group.position, { x: 0, y: 0, z: 0, duration, ease: 'power2.inOut' });
    gsap.to(this.lookAtTarget, { ...this.getBaseLookAt(), duration, ease: 'power2.inOut' });
  }

  setPerspective(perspective: CameraPerspective) {
    this.currentPerspective = perspective;
    if (perspective === 'broadcast') {
      this.basePosition.set(0, 9, 22);
    } else if (perspective === 'bowler') {
      this.basePosition.set(0, 3.5, 12); // Directly behind bowler
    } else if (perspective === 'batsman') {
      this.basePosition.set(0, 3, -11); // Directly behind batsman
    }
    this.reset();
  }

  private getBaseLookAt() {
    if (this.currentPerspective === 'broadcast') return { x: 0, y: 1.2, z: 0 };
    if (this.currentPerspective === 'bowler') return { x: 0, y: 0.8, z: 0 };
    if (this.currentPerspective === 'batsman') return { x: 0, y: 0.8, z: 4.0 };
    return { x: 0, y: 1.2, z: 0 };
  }

  /** Follow ball heavily on Z for depth tracking and offset X for width. */
  followBallOffset(worldX: number, worldZ: number, intensity: number) {
    const capX = 4 * intensity;
    const tx = THREE.MathUtils.clamp(worldX * 0.5, -capX, capX);
    
    // Smoothly pan the look at towards the deep outfield on Sixes
    gsap.to(this.lookAtTarget, {
      x: tx,
      z: worldZ * 0.7, // Track depth 70% of the way
      duration: 0.65,
      ease: 'power3.out',
      overwrite: 'auto',
    });
  }

  impactShake(strength = 1) {
    if (this.shakeTween) this.shakeTween.kill();
    const amp = 0.12 * strength;
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.to(this.group.position, { x: 0, y: 0, z: 0, duration: 0.2, ease: 'power2.out' });
      },
    });
    // Chain multiple tweens with independent random targets for true multi-directional shake.
    for (let i = 0; i < 5; i++) {
      tl.to(this.group.position, {
        x: (Math.random() - 0.5) * amp,
        y: (Math.random() - 0.5) * amp * 0.6,
        z: (Math.random() - 0.5) * amp * 0.4,
        duration: 0.05,
        ease: 'none',
      });
    }
    this.shakeTween = tl;
  }

  /** Tighter framing on wicket — zooms camera in and pans look-at to batting stumps. */
  wicketZoom() {
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.lookAtTarget);
    gsap.to(this.camera.position, {
      x: this.basePosition.x * 0.72,
      y: this.basePosition.y * 0.88,
      z: this.basePosition.z * 0.78,
      duration: 0.45,
      ease: 'power2.in',
    });
    gsap.to(this.lookAtTarget, {
      x: 0,
      y: 0.9,
      z: -10, // Target the batting stumps out to Z=-10
      duration: 0.45,
      ease: 'power2.in',
    });
    gsap.delayedCall(1.2, () => this.reset(0.7));
  }
}
