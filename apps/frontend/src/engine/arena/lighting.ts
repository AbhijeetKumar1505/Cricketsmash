import * as THREE from 'three';
import gsap from 'gsap';

export interface DynamicLighting {
  ambient: THREE.AmbientLight;
  hemi: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  ballPoint: THREE.PointLight;
  stadiumGroup: THREE.Group;
}

export function createArenaLighting(): DynamicLighting {
  const group = new THREE.Group();

  // Baseline moody stadium ambient
  const ambient = new THREE.AmbientLight(0x2a3a48, 0.4);
  group.add(ambient);

  // Cool sky tones transitioning down to dark grass
  const hemi = new THREE.HemisphereLight(0x406080, 0x0f1f10, 0.6);
  hemi.position.set(0, 40, 0);
  group.add(hemi);

  // Main floodlight (Key) targeting the pitch
  const key = new THREE.DirectionalLight(0xfff4e0, 1.0);
  key.position.set(-14, 25, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 60;
  key.shadow.camera.top = 22;
  key.shadow.camera.bottom = -22;
  key.shadow.camera.left = -22;
  key.shadow.camera.right = 22;
  key.shadow.bias = -0.0001;
  group.add(key);

  // Cool fill off-axis
  const fill = new THREE.DirectionalLight(0x4466aa, 0.6);
  fill.position.set(12, 12, -8);
  group.add(fill);

  // Rim lighting highlighting player/ball edges
  const rim = new THREE.DirectionalLight(0xffaa55, 0.5);
  rim.position.set(0, 5, -20);
  group.add(rim);

  // Dynamic point-light attached to the ball (glow scaling)
  const ballPoint = new THREE.PointLight(0xfffae0, 0, 12);
  ballPoint.position.set(0, 0, 0);
  group.add(ballPoint);

  return { ambient, hemi, key, fill, rim, ballPoint, stadiumGroup: group };
}

/**
 * Triggers GSAP timeline transitions updating lighting tones based on the game's risk state.
 */
export function updateLightingRiskEvent(state: DynamicLighting, riskLevel: 'idle' | 'low' | 'high' | 'extreme') {
  // We use simple proxy objects to tweens color channels seamlessly
  const proxy = {
    hemiSky: state.hemi.color.getHex(),
    hemiGrnd: state.hemi.groundColor.getHex(),
    keyColor: state.key.color.getHex(),
    rimInt: state.rim.intensity
  };

  let targSky = 0x406080;
  let targGrnd = 0x0f1f10;
  let targKey = 0xfff4e0;
  let targRimInt = 0.5;

  if (riskLevel === 'high') {
    // Shifting to intense warm thriller state
    targSky = 0xaa4040;
    targGrnd = 0x2a0f0f;
    targKey = 0xffeadd;
    targRimInt = 1.2;
  } else if (riskLevel === 'extreme') {
    // Gold/Yellow euphoria boundary hitting
    targSky = 0xffda55;
    targGrnd = 0x332a00;
    targKey = 0xffffff;
    targRimInt = 2.0;
  }

  gsap.to(proxy, {
    hemiSky: targSky,
    hemiGrnd: targGrnd,
    keyColor: targKey,
    rimInt: targRimInt,
    duration: 1.2,
    ease: 'sine.inOut',
    onUpdate: () => {
      state.hemi.color.setHex(proxy.hemiSky);
      state.hemi.groundColor.setHex(proxy.hemiGrnd);
      state.key.color.setHex(proxy.keyColor);
      state.rim.intensity = proxy.rimInt;
    }
  });
}
