import * as THREE from 'three';

// Flat illustration scene: bright sky + soft global lights so Standard/Phong characters read.

const SKY_COLOR = 0x98d8ea;

export class Scene {
  readonly three: THREE.Scene;
  private readonly _skyDome: THREE.Mesh;

  constructor() {
    this.three = new THREE.Scene();
    this.three.background = new THREE.Color(SKY_COLOR);
    this.three.fog = new THREE.Fog(0x8ac88f, 22, 74);

    const hemi = new THREE.HemisphereLight(0xf3fff7, 0x6e9d72, 0.62);
    hemi.position.set(0, 40, 0);
    const ambient = new THREE.AmbientLight(0xf5fbff, 0.3);
    const sun = new THREE.DirectionalLight(0xfff2dc, 0.9);
    sun.position.set(14, 24, 10);
    const rim = new THREE.DirectionalLight(0xcce7ff, 0.25);
    rim.position.set(-10, 8, -16);

    const skyGeo = new THREE.SphereGeometry(180, 28, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x8fd6ff) },
        uBottom: { value: new THREE.Color(0xe7fff0) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        uniform vec3 uTop;
        uniform vec3 uBottom;
        void main() {
          float h = clamp((vWorldPos.y + 20.0) / 120.0, 0.0, 1.0);
          vec3 color = mix(uBottom, uTop, h);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    this._skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.three.add(this._skyDome, hemi, ambient, sun, rim);
  }

  add(object: THREE.Object3D): void {
    this.three.add(object);
  }
}
