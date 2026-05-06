/**
 * Procedural sky bonus meshes — jetpack, small plane, big plane.
 * Emissive-forward materials so they read at distance (broadcast camera).
 */

import * as THREE from 'three';
import type { SkyObjectSnapshot, SkyObjectType } from '../../engine/sky/types.js';

function emissiveMat(hex: number, emissiveHex: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hex,
    emissive: emissiveHex,
    // Spec: emissiveIntensity ~2 so silhouettes read at distance.
    emissiveIntensity: 2,
    roughness: 0.45,
    metalness: 0.15,
  });
}

function baseScaleFor(type: SkyObjectType): number {
  // Spec-recommended scales.
  if (type === 'JETPACK') return 1.5;
  if (type === 'SMALL_PLANE') return 2.5;
  return 4;
}

export class SkyObject3D {
  readonly root = new THREE.Group();
  private readonly _parts: THREE.Mesh[] = [];
  private readonly _additive: THREE.Mesh[] = [];
  private _type: SkyObjectType;

  constructor(initial: SkyObjectSnapshot) {
    this._type = initial.type;
    this.root.name = `SkyObject_${initial.id}`;
    this._build(this._type);
    this._applySnapshot(initial);
  }

  update(snap: SkyObjectSnapshot, time: number): void {
    this.root.position.set(snap.position.x, snap.position.y, snap.position.z);
    const s = snap.scale * baseScaleFor(this._type);
    this.root.scale.setScalar(s);

    const pulse = 1 + snap.glowFlash * 0.45;
    for (const m of this._parts) {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.9 * pulse + snap.glowFlash * 1.4;
    }
    for (const m of this._additive) {
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + snap.glowFlash * 0.4;
    }

    // Face camera-ish: spin prop / subtle wobble
    if (this._type === 'SMALL_PLANE' || this._type === 'BIG_PLANE') {
      const prop = this.root.getObjectByName('prop') as THREE.Mesh | undefined;
      if (prop) prop.rotation.z = time * 24;
    }
    this.root.rotation.y = Math.sin(time * 0.7) * 0.04;
  }

  dispose(): void {
    for (const m of this._parts) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    for (const m of this._additive) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this._parts.length = 0;
    this._additive.length = 0;
  }

  private _applySnapshot(snap: SkyObjectSnapshot): void {
    this.root.position.set(snap.position.x, snap.position.y, snap.position.z);
    this.root.scale.setScalar(snap.scale * baseScaleFor(this._type));
  }

  private _build(type: SkyObjectType): void {
    if (type === 'JETPACK') this._buildJetpack();
    else if (type === 'SMALL_PLANE') this._buildSmallPlane();
    else this._buildBigPlane();
  }

  private _buildJetpack(): void {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 0.5, 6, 10),
      emissiveMat(0x4a6a8a, 0x8ec5ff),
    );
    body.frustumCulled = false;
    body.rotation.z = Math.PI / 2;
    this.root.add(body);
    this._parts.push(body);

    const flame = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.35),
      new THREE.MeshBasicMaterial({
        color: 0xff9a3c,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    flame.frustumCulled = false;
    flame.position.set(0, 0, 0.42);
    this.root.add(flame);
    this._additive.push(flame);
  }

  private _buildSmallPlane(): void {
    const fuse = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 1.1, 10),
      emissiveMat(0xc4f0ff, 0x7ae0ff),
    );
    fuse.frustumCulled = false;
    fuse.rotation.z = Math.PI / 2;
    this.root.add(fuse);
    this._parts.push(fuse);

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.05, 0.35),
      emissiveMat(0x7ad0ff, 0xa8f0ff),
    );
    wing.frustumCulled = false;
    wing.position.set(0, 0, 0.05);
    this.root.add(wing);
    this._parts.push(wing);

    const prop = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 8),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.1 }),
    );
    prop.frustumCulled = false;
    prop.name = 'prop';
    prop.rotation.y = Math.PI / 2;
    prop.position.set(0.58, 0, 0);
    this.root.add(prop);
    this._parts.push(prop);
  }

  private _buildBigPlane(): void {
    const fuse = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.24, 2.2, 12),
      emissiveMat(0xf0e6ff, 0xff6fe0),
    );
    fuse.frustumCulled = false;
    fuse.rotation.z = Math.PI / 2;
    this.root.add(fuse);
    this._parts.push(fuse);

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.06, 0.9),
      emissiveMat(0xff9af0, 0xff4fd8),
    );
    wing.frustumCulled = false;
    wing.position.set(0, 0, 0.05);
    this.root.add(wing);
    this._parts.push(wing);

    const engL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.35, 8),
      emissiveMat(0xd8c8ff, 0xff78f0),
    );
    engL.frustumCulled = false;
    engL.position.set(-0.35, -0.22, 0.45);
    const engR = engL.clone();
    engR.frustumCulled = false;
    engR.position.set(-0.35, -0.22, -0.45);
    this.root.add(engL, engR);
    this._parts.push(engL, engR);

    const trail = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.45),
      new THREE.MeshBasicMaterial({
        color: 0xffc8ff,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    trail.frustumCulled = false;
    trail.position.set(-1.35, 0.05, 0);
    trail.rotation.y = Math.PI / 2;
    this.root.add(trail);
    this._additive.push(trail);
  }
}
