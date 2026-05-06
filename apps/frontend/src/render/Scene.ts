import * as THREE from 'three';

// Flat illustration scene: bright sky, no dynamic lights, no fog.

const SKY_COLOR = 0x8ad2f6;

export class Scene {
  readonly three: THREE.Scene;

  constructor() {
    this.three = new THREE.Scene();
    this.three.background = new THREE.Color(SKY_COLOR);
    this.three.fog = null;
  }

  add(object: THREE.Object3D): void {
    this.three.add(object);
  }
}
