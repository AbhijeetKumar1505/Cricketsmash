import * as THREE from 'three';
import { createArenaLighting, updateLightingRiskEvent, type DynamicLighting } from './arena/lighting.js';
import { createEnvironment, type ArenaEnvironment } from './arena/environment.js';
import { createStarfield } from './objects/sky.js';
import type { EngineProps } from './CricketWebGLEngine.js';

export class LightingSystem {
  private stadiumLights: DynamicLighting;
  private environment: ArenaEnvironment;
  private prevRisk: string = 'idle';
  private strobeLight: THREE.PointLight;

  constructor(scene: THREE.Scene) {
    this.environment = createEnvironment();
    scene.add(this.environment.group);

    this.stadiumLights = createArenaLighting();
    scene.add(this.stadiumLights.stadiumGroup);

    const stars = createStarfield();
    scene.add(stars);

    // High-multiplier strobe — separate from the GSAP-driven risk lights
    this.strobeLight = new THREE.PointLight(0xff00ff, 0, 40);
    this.strobeLight.position.set(0, 22, 0);
    scene.add(this.strobeLight);
  }

  update(_dt: number, time: number, props: EngineProps) {
    this.environment.update(time);
    const ph = props.phase;
    const mult = props.multiplier;

    // Heat-based lighting shifts
    let risk: 'idle' | 'low' | 'high' | 'extreme' = 'idle';
    if (ph === 'bowl' || ph === 'hit') {
      if (mult > 12) risk = 'extreme';
      else if (mult > 5) risk = 'high';
      else if (mult > 2) risk = 'low';
    }

    if (risk !== this.prevRisk) {
      updateLightingRiskEvent(this.stadiumLights, risk);
      this.prevRisk = risk;
    }

    // Strobe flash at extreme multipliers — sine-gate at 28Hz
    if (ph === 'hit' && mult > 8) {
      const flash = Math.max(0, Math.sin(time * 28));
      this.strobeLight.intensity = flash * Math.min(2.2, (mult - 8) * 0.24);
      this.strobeLight.color.setHex(mult > 12 ? 0xff00ff : 0x00ffff);
    } else {
      this.strobeLight.intensity = 0;
    }
  }

  getStadiumLights() {
     return this.stadiumLights;
  }
}
