import gsap from 'gsap';
import type { StadiumCameraRig } from '../camera.js';

export function playWicketCamera(rig: StadiumCameraRig) {
  gsap.delayedCall(0.05, () => {
    rig.wicketZoom();
    rig.impactShake(1.1);
  });
}
