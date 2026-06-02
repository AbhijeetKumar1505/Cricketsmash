import * as THREE from 'three';
import { PITCH_MID_Z } from '../engine/worldLayout.js';

// Bright daylight stadium dome with warm sun key — Crystal Gold UI stays on top.

const SKY_BG = 0xc8e6ff;

const SKY_VERTEX = `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAGMENT = `
  varying vec3 vWorldPos;
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform float uTime;
  uniform vec3 uSunDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.52;
    for (int i = 0; i < 5; i++) {
      v += a * noise2(p);
      p *= 2.05;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float h = clamp((vWorldPos.y + 20.0) / 120.0, 0.0, 1.0);
    vec3 color;
    if (h < 0.32) {
      color = mix(uHorizon, uMid, h / 0.32);
    } else {
      color = mix(uMid, uZenith, (h - 0.32) / 0.68);
    }

    vec3 wp = vWorldPos;
    vec2 wind = vec2(uTime * 0.014, uTime * 0.009);
    vec2 cloudUv = wp.xz * 0.019 + wp.y * 0.007 + wind;
    float cf = fbm(cloudUv);
    float cf2 = fbm(cloudUv * 1.7 + vec2(-wind.y, wind.x) * 1.3);
    cf = cf * 0.55 + cf2 * 0.45;
    cf = smoothstep(0.36, 0.88, cf);
    vec3 cloudCol = vec3(0.99, 0.995, 1.0);
    color = mix(color, cloudCol, cf * 0.55);

    vec3 dir = normalize(vWorldPos);
    float sunDot = max(dot(dir, uSunDir), 0.0);
    float corona = pow(sunDot, 96.0) * 0.85 + pow(sunDot, 512.0) * 2.1;
    color += vec3(1.0, 0.97, 0.88) * corona * 0.55;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class Scene {
  readonly three: THREE.Scene;
  private readonly _skyDome: THREE.Mesh;
  private readonly _skyMat: THREE.ShaderMaterial;

  constructor() {
    this.three = new THREE.Scene();
    this.three.background = new THREE.Color(SKY_BG);
    // Bright daytime aerial perspective — light blue fog softens the boundary stands.
    this.three.fog = new THREE.Fog(0xc9e8ff, 42, 155);

    const sunPos = new THREE.Vector3(-38, 76, -30);
    const sunDir = sunPos.clone().normalize();

    const hemi = new THREE.HemisphereLight(0x7ec8ff, 0xd4ebd4, 0.62);
    hemi.position.set(0, 80, 0);
    const ambient = new THREE.AmbientLight(0xffffff, 0.50);

    // Bright sun key — natural daylight on the field
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.45);
    sun.position.copy(sunPos);
    sun.target.position.set(0, 0.5, PITCH_MID_Z);
    this.three.add(sun.target);

    const fillCool = new THREE.DirectionalLight(0xe3f0ff, 0.42);
    fillCool.position.set(28, 36, 22);

    const fillWarm = new THREE.DirectionalLight(0xffefd2, 0.30);
    fillWarm.position.set(14, 22, PITCH_MID_Z + 26);

    const bounce = new THREE.DirectionalLight(0x6ccd7a, 0.22);
    bounce.position.set(0, -2, PITCH_MID_Z);

    const skyGeo = new THREE.SphereGeometry(180, 36, 24);
    this._skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: sunDir.clone() },
        uZenith:  { value: new THREE.Color(0x2e8fee) },
        uMid:     { value: new THREE.Color(0x6cc4ff) },
        uHorizon: { value: new THREE.Color(0xfff0c8) },
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
    });
    this._skyDome = new THREE.Mesh(skyGeo, this._skyMat);
    this.three.add(this._skyDome, hemi, ambient, sun, fillCool, fillWarm, bounce);
  }

  /** Drive sky cloud scroll + sun halo (call each frame). */
  updateEnvironment(elapsedSeconds: number): void {
    this._skyMat.uniforms.uTime.value = elapsedSeconds;
  }

  add(object: THREE.Object3D): void {
    this.three.add(object);
  }
}
