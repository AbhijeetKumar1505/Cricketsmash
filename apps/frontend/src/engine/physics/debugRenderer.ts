/**
 * debugRenderer.ts — Optional Three.js debug overlays for the physics system.
 *
 * Adds to the scene (all hidden by default, enabled via `enabled = true`):
 *   • Trajectory arc line (white dashed arc from ball → predicted landing)
 *   • Landing prediction marker (yellow ring on ground)
 *   • Hit timing window bar (screen-space canvas sprite)
 *   • Fielder intercept marker (green dot at predicted landing)
 *
 * Usage:
 *   const dbg = new PhysicsDebugRenderer(threeScene);
 *   dbg.enabled = true;      // enable in dev builds
 *   // each frame:
 *   dbg.update(ballBody, predictedLanding, elapsed, hitTime, goodWindow);
 */

import * as THREE from 'three';
import type { BallBody } from './ballController.js';
import { TrajectorySolver } from './trajectorySolver.js';
import { Vec3 } from './physics.js';

// ── PhysicsDebugRenderer ──────────────────────────────────────────────────────

export class PhysicsDebugRenderer {
  enabled = false;

  private readonly scene:    THREE.Scene;
  private readonly solver:   TrajectorySolver;

  // Scene objects
  private arcLine:         THREE.Line        | null = null;
  private landingRing:     THREE.Mesh        | null = null;
  private fielderDot:      THREE.Mesh        | null = null;
  private timingSprite:    THREE.Sprite      | null = null;
  private timingCanvas:    HTMLCanvasElement | null = null;
  private timingTexture:   THREE.CanvasTexture | null = null;

  // Dispose tracking
  private readonly _disposables: THREE.BufferGeometry[] = [];
  private readonly _materials:   THREE.Material[]       = [];

  constructor(scene: THREE.Scene) {
    this.scene  = scene;
    this.solver = new TrajectorySolver();
    this._build();
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  /**
   * Update all debug overlays. Call after physics update each frame.
   *
   * @param ball          Ball body (position + velocity from BallController)
   * @param landing       Predicted landing Vec3 or null
   * @param elapsed       Ball elapsed time (seconds since bowl)
   * @param idealHitTime  Seconds when ball reaches batsman
   * @param goodWindow    ±seconds for "good" timing zone
   */
  update(
    ball:         Readonly<BallBody>,
    landing:      Vec3 | null,
    elapsed:      number,
    idealHitTime: number,
    goodWindow:   number,
  ): void {
    const vis = this.enabled && (ball.state === 'airborne' || ball.state === 'hit');

    this._updateArcLine(ball, vis);
    this._updateLandingMarker(landing, vis);
    this._updateTimingBar(elapsed, idealHitTime, goodWindow, vis);
  }

  /** Show/hide fielder intercept marker. */
  showFielderIntercept(point: Vec3 | null): void {
    if (!this.fielderDot) return;
    if (!this.enabled || !point) {
      this.fielderDot.visible = false;
      return;
    }
    this.fielderDot.position.set(point.x, 0.05, point.z);
    this.fielderDot.visible = true;
  }

  dispose(): void {
    for (const g of this._disposables) g.dispose();
    for (const m of this._materials) m.dispose();
    this.timingTexture?.dispose();
    [this.arcLine, this.landingRing, this.fielderDot, this.timingSprite]
      .forEach(o => o && this.scene.remove(o));
  }

  // ── Construction ─────────────────────────────────────────────────────────────

  private _build(): void {
    // ── Trajectory arc line ───────────────────────────────────────────────────
    const arcGeo  = new THREE.BufferGeometry();
    // Pre-allocate 90 points; we'll update their positions each frame
    arcGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(90 * 3), 3),
    );
    const arcMat = new THREE.LineBasicMaterial({
      color:       0xffffff,
      transparent: true,
      opacity:     0.55,
      depthTest:   false,
    });
    this.arcLine = new THREE.Line(arcGeo, arcMat);
    this.arcLine.visible      = false;
    this.arcLine.renderOrder  = 10;
    this.scene.add(this.arcLine);
    this._disposables.push(arcGeo);
    this._materials.push(arcMat);

    // ── Landing prediction ring ───────────────────────────────────────────────
    const ringGeo = new THREE.RingGeometry(0.28, 0.38, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color:       0xffee00,
      side:        THREE.DoubleSide,
      transparent: true,
      opacity:     0.7,
      depthTest:   false,
    });
    this.landingRing = new THREE.Mesh(ringGeo, ringMat);
    this.landingRing.rotation.x = -Math.PI / 2;
    this.landingRing.position.y = 0.02;
    this.landingRing.visible    = false;
    this.landingRing.renderOrder = 9;
    this.scene.add(this.landingRing);
    this._disposables.push(ringGeo);
    this._materials.push(ringMat);

    // ── Fielder intercept dot ─────────────────────────────────────────────────
    const dotGeo = new THREE.CircleGeometry(0.22, 16);
    const dotMat = new THREE.MeshBasicMaterial({
      color:       0x00ff88,
      transparent: true,
      opacity:     0.65,
      depthTest:   false,
    });
    this.fielderDot = new THREE.Mesh(dotGeo, dotMat);
    this.fielderDot.rotation.x  = -Math.PI / 2;
    this.fielderDot.position.y  = 0.025;
    this.fielderDot.visible     = false;
    this.fielderDot.renderOrder = 9;
    this.scene.add(this.fielderDot);
    this._disposables.push(dotGeo);
    this._materials.push(dotMat);

    // ── Hit timing window sprite ──────────────────────────────────────────────
    this.timingCanvas  = document.createElement('canvas');
    this.timingCanvas.width  = 320;
    this.timingCanvas.height = 48;
    this.timingTexture = new THREE.CanvasTexture(this.timingCanvas);
    this.timingTexture.colorSpace = THREE.SRGBColorSpace;

    const spriteMat = new THREE.SpriteMaterial({
      map:         this.timingTexture,
      transparent: true,
      depthTest:   false,
    });
    this.timingSprite = new THREE.Sprite(spriteMat);
    this.timingSprite.scale.set(2.8, 0.42, 1);
    this.timingSprite.position.set(0, 2.4, 0.5);   // hover above batsman
    this.timingSprite.visible    = false;
    this.timingSprite.renderOrder = 11;
    this.scene.add(this.timingSprite);
    this._materials.push(spriteMat);
  }

  // ── Private update helpers ───────────────────────────────────────────────────

  private _updateArcLine(ball: Readonly<BallBody>, visible: boolean): void {
    if (!this.arcLine) return;
    this.arcLine.visible = visible;
    if (!visible) return;

    const bPos = ball.position;
    const bVel = ball.velocity;
    const pts  = this.solver.sampleArc(
      new Vec3(bPos.x, bPos.y, bPos.z),
      new Vec3(bVel.x, bVel.y, bVel.z),
      90,
    );

    const attr  = this.arcLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr   = attr.array as Float32Array;
    const count = Math.min(pts.length, 90);

    for (let i = 0; i < count; i++) {
      arr[i * 3]     = pts[i].x;
      arr[i * 3 + 1] = pts[i].y;
      arr[i * 3 + 2] = pts[i].z;
    }
    // Pad remaining slots to last point
    const last = pts[count - 1] ?? new Vec3(bPos.x, bPos.y, bPos.z);
    for (let i = count; i < 90; i++) {
      arr[i * 3]     = last.x;
      arr[i * 3 + 1] = last.y;
      arr[i * 3 + 2] = last.z;
    }

    attr.needsUpdate = true;
    this.arcLine.geometry.setDrawRange(0, count);
  }

  private _updateLandingMarker(landing: Vec3 | null, visible: boolean): void {
    if (!this.landingRing) return;
    if (!visible || !landing) { this.landingRing.visible = false; return; }
    this.landingRing.position.set(landing.x, 0.02, landing.z);
    this.landingRing.visible = true;
  }

  private _updateTimingBar(
    elapsed:      number,
    idealHitTime: number,
    goodWindow:   number,
    visible:      boolean,
  ): void {
    if (!this.timingSprite || !this.timingCanvas || !this.timingTexture) return;
    this.timingSprite.visible = visible;
    if (!visible) return;

    const W = this.timingCanvas.width;
    const H = this.timingCanvas.height;
    const cx = this.timingCanvas.getContext('2d')!;

    cx.clearRect(0, 0, W, H);

    // Background track
    const trackW = W - 24;
    const trackX = 12;
    const trackH = 10;
    const trackY = (H - trackH) / 2;
    cx.fillStyle = 'rgba(0,0,0,0.5)';
    cx.beginPath();
    cx.roundRect(trackX, trackY, trackW, trackH, 4);
    cx.fill();

    // Zones
    const centre  = trackX + trackW * 0.5;
    const pxPerS  = (trackW * 0.5) / goodWindow;   // pixels per second

    // Good zone (yellow)
    const gHalfW = goodWindow * pxPerS;
    cx.fillStyle = 'rgba(255, 200, 40, 0.55)';
    cx.fillRect(centre - gHalfW, trackY, gHalfW * 2, trackH);

    // Perfect zone (green)
    const pHalfW = 0.08 * pxPerS;
    cx.fillStyle = 'rgba(80, 255, 80, 0.75)';
    cx.fillRect(centre - pHalfW, trackY, pHalfW * 2, trackH);

    // Cursor (ball progress)
    const error    = elapsed - idealHitTime;
    const cursorX  = Math.max(trackX + 2, Math.min(trackX + trackW - 2,
      centre + error * pxPerS));
    const inPerfect = Math.abs(error) <= 0.08;
    const inGood    = Math.abs(error) <= goodWindow;
    cx.fillStyle = inPerfect ? '#44ff44' : inGood ? '#ffcc22' : '#ff4444';
    cx.fillRect(cursorX - 2, trackY - 3, 4, trackH + 6);

    // Label
    cx.fillStyle = 'rgba(255,255,255,0.85)';
    cx.font = '10px monospace';
    cx.textAlign = 'center';
    cx.textBaseline = 'bottom';
    cx.fillText('HIT WINDOW', W / 2, trackY - 2);

    this.timingTexture.needsUpdate = true;
  }
}
