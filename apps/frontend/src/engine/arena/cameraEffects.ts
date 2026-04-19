import gsap from 'gsap';
import type { StadiumCameraRig } from '../camera.js';

export function applyBreathingCamera(rig: StadiumCameraRig, time: number) {
  // Constant micro-drift for the LookAt target
  const driftSpeed = time * 0.4;
  rig.lookAtTarget.x += Math.sin(driftSpeed) * 0.0012;
  rig.lookAtTarget.y += Math.cos(driftSpeed * 0.7) * 0.0006;
  
  // Continuous breathing zoom (requires projection matrix update)
  const fovBump = Math.sin(time * 0.8) * 0.2;
  // Apply against base 40 deg FOV
  rig.camera.fov = 40 + fovBump;
  rig.camera.updateProjectionMatrix();
}

/**
 * Triggers an immediate violent structural shake against the rendering rig group,
 * simulating heavy impacts (Bats hitting balls, or Balls shattering wickets)
 */
export function triggerHardwareShake(rig: StadiumCameraRig, intensity: 'mild' | 'heavy') {
  const proxy = { ox: 0, oy: 0, oz: 0 };
  
  const p = intensity === 'heavy' ? 0.35 : 0.15;
  
  // Create randomized jarring offsets
  gsap.to(proxy, {
    ox: p,
    oy: p,
    oz: p,
    duration: 0.05,
    ease: "power4.in",
    yoyo: true,
    repeat: intensity === 'heavy' ? 5 : 3,
    onUpdate: () => {
      // Apply volatile random shaking tied to proxy peaks
      rig.group.position.x += (Math.random() - 0.5) * proxy.ox;
      rig.group.position.y += (Math.random() - 0.5) * proxy.oy;
      rig.group.position.z += (Math.random() - 0.5) * proxy.oz;
    },
    onComplete: () => {
      // Re-center explicitly using rigid Tween
      gsap.to(rig.group.position, {
        x: 0, y: 0, z: 0, duration: 0.15, ease: "power2.out"
      });
    }
  });
}
