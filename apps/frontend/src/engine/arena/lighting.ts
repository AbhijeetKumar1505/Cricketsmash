import * as THREE from 'three';
import gsap from 'gsap';

export interface DynamicLighting {
  stadiumGroup: THREE.Group;
  ballPoint: THREE.PointLight;
}

export function createArenaLighting(): DynamicLighting {
  const stadiumGroup = new THREE.Group();

  // 1. Clean Flat Ambient Light
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  stadiumGroup.add(ambient);
  
  // 2. Simple Bright Sun
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(30, 60, 30);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  stadiumGroup.add(key);

  // Ball highlight (very subtle)
  const ballPoint = new THREE.PointLight(0xffffff, 0, 10);
  stadiumGroup.add(ballPoint);

  return { stadiumGroup, ballPoint };
}

export function triggerLightingFlicker(lighting: DynamicLighting) {
  // Cartoon flicker logic
  const original = lighting.ballPoint.intensity;
  gsap.to(lighting.ballPoint, {
    intensity: 2.0,
    duration: 0.05,
    repeat: 5,
    yoyo: true,
    onComplete: () => {
       lighting.ballPoint.intensity = original;
    }
  });
}

export function updateLightingRiskEvent(_lighting: DynamicLighting, _event: string) {
  // Static lighting for consistency
}
