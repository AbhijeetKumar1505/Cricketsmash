import * as THREE from 'three';
import { BALL } from '../../engine/constants.js';
import type { BallData } from '../../engine/systems/BallSystem.js';
import type { DoodleAssets } from '../doodle/DoodleAssets.js';

const TRAIL_BASE   = 24;   // segments pre-hit
const TRAIL_BOOST  = 48;   // segments post-hit when boosted (six)

const _scratchColor = new THREE.Color();

export class BallEntity {
  readonly root: THREE.Group;

  private readonly mesh: THREE.Mesh;
  private readonly shadow: THREE.Mesh;
  private readonly glow: THREE.Sprite;
  // Trail: oversized buffer (TRAIL_BOOST capacity) but only `_trailLen` segments drawn
  private readonly trail: THREE.Line;
  private readonly _trailPos:  Float32Array;
  private readonly _trailCol:  Float32Array;
  private _trailIdx = 0;
  private _trailLen = TRAIL_BASE;
  private _trailFilled = 0;
  private _trailColor = new THREE.Color(0xffcdd2);
  private _trailBaseOpacity = 0.55;
  private _lastActive = false;
  private _burstTimer = 0;

  constructor(assets: DoodleAssets) {
    this.root = new THREE.Group();

    const geo = new THREE.SphereGeometry(BALL.RADIUS * 1.4, 12, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xe53935 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.root.add(this.mesh);

    const glowMat = new THREE.SpriteMaterial({
      map: assets.ballGlow,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.6,
    });
    this.glow = new THREE.Sprite(glowMat);
    this.glow.scale.set(0.6, 0.6, 0.6);
    this.mesh.add(this.glow);

    const seamGeo = new THREE.TorusGeometry(BALL.RADIUS * 1.42, 0.004, 4, 24);
    const seamMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const seam = new THREE.Mesh(seamGeo, seamMat);
    this.mesh.add(seam);

    const shadowGeo = new THREE.PlaneGeometry(0.5, 0.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: assets.shadow,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.root.add(this.shadow);

    // ── Trail: vertex-colored Line with per-segment alpha fade ─────────────
    this._trailPos = new Float32Array(TRAIL_BOOST * 3);
    this._trailCol = new Float32Array(TRAIL_BOOST * 4);  // rgba
    // Initialize positions far below ground so initial frames don't render a horizon line
    for (let i = 0; i < TRAIL_BOOST; i++) {
      this._trailPos[i * 3 + 1] = -100;
    }
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(this._trailPos, 3));
    trailGeo.setAttribute('color',    new THREE.BufferAttribute(this._trailCol, 4));
    trailGeo.setDrawRange(0, TRAIL_BASE);
    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent:  true,
      blending:     THREE.AdditiveBlending,
      depthWrite:   false,
    });
    this.trail = new THREE.Line(trailGeo, trailMat);
    this.trail.frustumCulled = false;
    this.root.add(this.trail);
  }

  /** Set trail color + opacity + length boost (true = post-six extended trail). */
  setTrailLook(colorHex: number, opacity: number, boost: boolean): void {
    this._trailColor.setHex(colorHex);
    this._trailBaseOpacity = opacity;
    const wantLen = boost ? TRAIL_BOOST : TRAIL_BASE;
    if (wantLen !== this._trailLen) {
      this._trailLen = wantLen;
      this.trail.geometry.setDrawRange(0, this._trailLen);
    }
  }

  /** Trigger a visual trail burst — brighter, longer streak for ~150ms */
  burst(duration: number): void {
    this._burstTimer = Math.max(this._burstTimer, duration);
    // Switch to max trail length during burst for longer streak
    if (this._trailLen < TRAIL_BOOST) {
      this._trailLen = TRAIL_BOOST;
      this.trail.geometry.setDrawRange(0, this._trailLen);
    }
  }

  update(ball: BallData, dt: number): void {
    const visible = ball.active;
    this.root.visible = visible;

    // Reset trail when delivery starts (false→true edge)
    if (visible && !this._lastActive) {
      this._burstTimer = 0;
      this._trailIdx = 0;
      this._trailFilled = 0;
      for (let i = 0; i < TRAIL_BOOST; i++) {
        this._trailPos[i * 3]     = ball.x;
        this._trailPos[i * 3 + 1] = -100;
        this._trailPos[i * 3 + 2] = ball.z;
        this._trailCol[i * 4]     = 0;
        this._trailCol[i * 4 + 1] = 0;
        this._trailCol[i * 4 + 2] = 0;
        this._trailCol[i * 4 + 3] = 0;
      }
      // Restore default trail length
      if (this._trailLen !== TRAIL_BASE) {
        this._trailLen = TRAIL_BASE;
        this.trail.geometry.setDrawRange(0, this._trailLen);
      }
    }
    this._lastActive = visible;
    if (!visible) return;

    // Decay burst timer
    if (this._burstTimer > 0) {
      this._burstTimer = Math.max(0, this._burstTimer - dt);
      if (this._burstTimer <= 0 && this._trailLen > TRAIL_BASE) {
        this._trailLen = TRAIL_BASE;
        this.trail.geometry.setDrawRange(0, this._trailLen);
      }
    }

    this.mesh.position.set(ball.x, ball.y, ball.z);
    this.mesh.rotation.x = ball.rx * 0.5;
    this.mesh.rotation.z = ball.rz * 0.5;

    if (ball.y < 0.08) this.mesh.scale.set(1.3, 0.7, 1.3);
    else if (Math.abs(ball.vy) > 4) this.mesh.scale.set(0.85, 1.2, 0.85);
    else this.mesh.scale.set(1, 1, 1);

    this.shadow.position.set(ball.x, 0.005, ball.z);
    const shadowScale = Math.max(0.3, 1 - ball.y * 0.15);
    this.shadow.scale.set(shadowScale, shadowScale, shadowScale);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.18 * shadowScale;

    // Append new position to ring buffer
    const writeI = this._trailIdx % this._trailLen;
    this._trailPos[writeI * 3]     = ball.x;
    this._trailPos[writeI * 3 + 1] = ball.y;
    this._trailPos[writeI * 3 + 2] = ball.z;
    this._trailIdx++;
    this._trailFilled = Math.min(this._trailFilled + 1, this._trailLen);

    // Rebuild draw buffer: tail at i=0 (oldest), head at i=len-1 (current)
    // Fade alpha along length, head brightest.
    const posAttr = this.trail.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = this.trail.geometry.attributes.color    as THREE.BufferAttribute;
    const len = this._trailLen;
    for (let i = 0; i < len; i++) {
      // Read from ring: oldest at (_trailIdx - len + i)
      const srcI = ((this._trailIdx - len + i) % len + len) % len;
      const px = this._trailPos[srcI * 3];
      const py = this._trailPos[srcI * 3 + 1];
      const pz = this._trailPos[srcI * 3 + 2];
      posAttr.setXYZ(i, px, py, pz);

      // Alpha ramp 0 (tail) → 1 (head), with quadratic for sharper head
      // Burst: 2.5x brightness + full-opacity head during contact freeze
      const burstMul = this._burstTimer > 0 ? 2.5 : 1.0;
      const t = i / Math.max(1, len - 1);
      const alpha = t * t * this._trailBaseOpacity * burstMul;
      _scratchColor.copy(this._trailColor);
      colAttr.setXYZW(i, _scratchColor.r, _scratchColor.g, _scratchColor.b, alpha);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
    this.trail.geometry.dispose();
    (this.trail.material as THREE.Material).dispose();
  }
}
