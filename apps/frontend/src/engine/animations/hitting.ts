import type { StadiumCameraRig } from '../camera.js';

export function playHitCamera(
  rig: StadiumCameraRig,
  worldBallX: number,
  worldBallZ: number,
  kind: 'six' | 'four' | 'neutral'
) {
  if (kind === 'six') {
    rig.followBallOffset(worldBallX, worldBallZ, 1);
    rig.impactShake(0.7);
  } else if (kind === 'four') {
    rig.followBallOffset(worldBallX, worldBallZ, 0.55);
    rig.impactShake(0.45);
  } else {
    rig.impactShake(0.25);
  }
}
