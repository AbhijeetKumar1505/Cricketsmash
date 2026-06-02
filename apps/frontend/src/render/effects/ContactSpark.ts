/**
 * ContactSpark — short-lived radial particle burst at bat contact.
 *
 * Pre-allocated pool of 14 small additive sprites; trigger() places them at a
 * world position with random outward velocities, fades them over ~250ms.
 * Cheap: no per-frame allocations after construction.
 */

import * as THREE from 'three';

const PARTICLE_COUNT = 14;
const LIFETIME       = 0.28;   // seconds

interface Particle {
  vx: number; vy: number; vz: number;
  life: number;     // seconds remaining
}

export class ContactSpark {
  readonly root: THREE.Group;
  private readonly _sprites: THREE.Sprite[] = [];
  private readonly _state:   Particle[]   = [];
  private readonly _flash:   THREE.Sprite;
  private _flashLife = 0;

  constructor() {
    this.root = new THREE.Group();
    this.root.visible = false;

    // Build a small radial-gradient texture (white core fading to transparent)
    const tex = this._buildGradientTexture();

    const sparkMat = new THREE.SpriteMaterial({
      map: tex,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const s = new THREE.Sprite(sparkMat.clone());
      s.scale.set(0.18, 0.18, 0.18);
      s.visible = false;
      this.root.add(s);
      this._sprites.push(s);
      this._state.push({ vx: 0, vy: 0, vz: 0, life: 0 });
    }

    // Bright central flash sprite — larger, fades faster
    this._flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex,
      color: 0xffffcc,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    this._flash.scale.set(0.6, 0.6, 0.6);
    this._flash.visible = false;
    this.root.add(this._flash);
  }

  trigger(worldX: number, worldY: number, worldZ: number, intensity = 1): void {
    this.root.visible = true;
    this._flash.position.set(worldX, worldY, worldZ);
    this._flash.visible = true;
    this._flashLife = LIFETIME * 0.6;

    const scaleMul = 0.5 + intensity * 0.5;  // ranges from 0.5 (weak) to 1.0 (max)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const sp = this._sprites[i];
      const st = this._state[i];
      sp.position.set(worldX, worldY, worldZ);
      sp.visible = true;
      const theta = Math.random() * Math.PI * 2;
      const phi   = (Math.random() - 0.5) * Math.PI;
      const speed = (1.6 + Math.random() * 2.4) * scaleMul;
      st.vx = Math.cos(theta) * Math.cos(phi) * speed;
      st.vy = Math.sin(phi) * speed + 0.6;
      st.vz = Math.sin(theta) * Math.cos(phi) * speed;
      st.life = LIFETIME * (0.65 + Math.random() * 0.5);
      const mat = sp.material as THREE.SpriteMaterial;
      mat.opacity = 1;
      const sc = 0.18 * scaleMul;
      sp.scale.set(sc, sc, sc);
    }
  }

  update(dt: number): void {
    if (!this.root.visible) return;
    let anyAlive = false;

    if (this._flashLife > 0) {
      this._flashLife -= dt;
      const t = Math.max(0, this._flashLife / (LIFETIME * 0.6));
      (this._flash.material as THREE.SpriteMaterial).opacity = t * t;
      const s = 0.6 + (1 - t) * 0.8;
      this._flash.scale.set(s, s, s);
      if (this._flashLife > 0) anyAlive = true;
      else this._flash.visible = false;
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const sp = this._sprites[i];
      const st = this._state[i];
      if (st.life <= 0) { sp.visible = false; continue; }
      st.life -= dt;
      sp.position.x += st.vx * dt;
      sp.position.y += st.vy * dt;
      sp.position.z += st.vz * dt;
      st.vy -= 4.5 * dt;  // gravity
      const tNorm = Math.max(0, st.life / LIFETIME);
      (sp.material as THREE.SpriteMaterial).opacity = tNorm;
      const sc = 0.18 * (0.6 + tNorm * 0.8);
      sp.scale.set(sc, sc, sc);
      if (st.life > 0) anyAlive = true;
      else sp.visible = false;
    }

    if (!anyAlive) this.root.visible = false;
  }

  dispose(): void {
    for (const sp of this._sprites) {
      (sp.material as THREE.SpriteMaterial).map?.dispose();
      (sp.material as THREE.SpriteMaterial).dispose();
    }
    (this._flash.material as THREE.SpriteMaterial).map?.dispose();
    (this._flash.material as THREE.SpriteMaterial).dispose();
  }

  private _buildGradientTexture(): THREE.CanvasTexture {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0,    'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1,    'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
}
