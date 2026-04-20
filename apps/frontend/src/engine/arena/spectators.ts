import * as THREE from 'three';

// ─── Three-Tier Living Crowd System ──────────────────────────────────────────
//
// Tier 1 (Near):  1500 instances — radius 40–55, y 3–12  — vivid, larger
// Tier 2 (Mid):   2000 instances — radius 55–70, y 12–24 — depth fill
// Tier 3 (Far):   1500 instances — radius 70–85, y 24–34 — silhouettes + flicker
//
// Performance: Batched updates (1/3 per frame per tier), instanced meshes.

// ─── Color Palettes (5 variations per tier) ──────────────────────────────────

const TIER1_COLORS = [
  0xe0e7ff,  // light lavender (neutral fans)
  0xf43f5e,  // red team
  0x10b981,  // green team
  0xfbbf24,  // gold fans
  0x3b82f6,  // blue section
];

const TIER2_COLORS = [
  0x8b95b8,  // muted lavender
  0xb83050,  // dark red
  0x0d8060,  // dark green
  0xb08a1a,  // dark gold
  0x2555a0,  // dark blue
];

const TIER3_COLORS = [
  0x3a3f55,  // dark silhouette
  0x4a2030,  // deep red shadow
  0x1a3528,  // deep green shadow
  0x3a3018,  // deep gold shadow
  0x1a2540,  // deep blue shadow
];

// ─── Crowd States ────────────────────────────────────────────────────────────

export type CrowdState = 'idle' | 'engaged' | 'hyped' | 'shocked' | 'celebration';
export type CrowdReaction = 'idle' | 'clap' | 'jump' | 'wave' | 'settle' | 'dismay';

interface TierConfig {
  count: number;
  radiusMin: number;
  radiusMax: number;
  yMin: number;
  yMax: number;
  planeW: number;
  planeH: number;
  colors: number[];
  opacity: number;
  blending: THREE.Blending;
}

const TIER_CONFIGS: TierConfig[] = [
  // Tier 1 — Near Crowd
  {
    count: 1500, radiusMin: 40, radiusMax: 55, yMin: 3, yMax: 12,
    planeW: 0.22, planeH: 0.38, colors: TIER1_COLORS,
    opacity: 0.65, blending: THREE.AdditiveBlending,
  },
  // Tier 2 — Mid Crowd
  {
    count: 2000, radiusMin: 55, radiusMax: 70, yMin: 12, yMax: 24,
    planeW: 0.16, planeH: 0.28, colors: TIER2_COLORS,
    opacity: 0.5, blending: THREE.AdditiveBlending,
  },
  // Tier 3 — Far Silhouettes
  {
    count: 1500, radiusMin: 70, radiusMax: 85, yMin: 24, yMax: 34,
    planeW: 0.12, planeH: 0.2, colors: TIER3_COLORS,
    opacity: 0.35, blending: THREE.AdditiveBlending,
  },
];

// ─── Tier Instance Data ──────────────────────────────────────────────────────

interface TierData {
  mesh: THREE.InstancedMesh;
  angles: Float32Array;     // pre-computed angle around stadium center
  heights: Float32Array;    // base Y scale (height variation)
  radii: Float32Array;      // pre-computed radius from center
  timeOffsets: Float32Array; // random phase offsets (breaks sync)
  batchSize: number;
  currentBatch: number;
}

// ─── Spectator System Class ──────────────────────────────────────────────────

export class SpectatorSystem {
  group: THREE.Group;
  private tiers: TierData[] = [];
  private time = 0;
  private excitementLevel = 0;

  private currentReaction: CrowdReaction = 'idle';
  private reactionTimer = 0;

  private currentState: CrowdState = 'idle';
  private stateTimer = 0;

  private waveActive = false;
  private waveTime = 0;
  private waveType: 'mexican' | 'pulse' | 'directional' = 'mexican';
  private waveDirection: 'left' | 'right' | 'radial' = 'radial';

  constructor() {
    this.group = new THREE.Group();

    for (let ti = 0; ti < TIER_CONFIGS.length; ti++) {
      const cfg = TIER_CONFIGS[ti]!;
      const tier = this.createTier(cfg, ti);
      this.tiers.push(tier);
      this.group.add(tier.mesh);
    }
  }

  private createTier(cfg: TierConfig, _tierIndex: number): TierData {
    const geo = new THREE.PlaneGeometry(cfg.planeW, cfg.planeH);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: cfg.opacity,
      side: THREE.DoubleSide,
      blending: cfg.blending,
      depthWrite: false,
    });

    const mesh = new THREE.InstancedMesh(geo, mat, cfg.count);
    const angles = new Float32Array(cfg.count);
    const radii = new Float32Array(cfg.count);
    const heights = new Float32Array(cfg.count);
    const timeOffsets = new Float32Array(cfg.count);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < cfg.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      angles[i] = angle;

      const radius = cfg.radiusMin + Math.random() * (cfg.radiusMax - cfg.radiusMin);
      radii[i] = radius;

      const y = cfg.yMin + Math.random() * (cfg.yMax - cfg.yMin);

      dummy.position.set(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius,
      );
      dummy.lookAt(0, y, 0);

      // Height variation (0.75 – 1.25)
      const heightScale = 0.75 + Math.random() * 0.5;
      heights[i] = heightScale;
      dummy.scale.set(1, heightScale, 1);

      // Random timing offset
      timeOffsets[i] = Math.random() * Math.PI * 2;

      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Color assignment
      const colorIdx = Math.floor(Math.random() * cfg.colors.length);
      color.setHex(cfg.colors[colorIdx]!);

      const variation = 0.85 + Math.random() * 0.3;
      color.r *= variation;
      color.g *= variation;
      color.b *= variation;

      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    const batchSize = Math.ceil(cfg.count / 3);

    return { mesh, angles, radii, heights, timeOffsets, batchSize, currentBatch: 0 };
  }

  // ── Public API ──

  setState(state: CrowdState) {
    this.currentState = state;
    this.stateTimer = 0;
  }

  setExcitement(level: number) {
    this.excitementLevel = Math.max(0, Math.min(1, level));
  }

  triggerReaction(reaction: CrowdReaction) {
    this.currentReaction = reaction;
    this.reactionTimer = 0;
  }

  triggerMexicanWave() {
    this.waveActive = true;
    this.waveTime = 0;
    this.waveType = 'mexican';
  }

  triggerDirectionalWave(dir: 'left' | 'right' | 'radial') {
    this.waveActive = true;
    this.waveTime = 0;
    this.waveType = 'directional';
    this.waveDirection = dir;
  }

  update(dt: number) {
    this.time += dt;
    this.reactionTimer += dt;
    this.stateTimer += dt;

    if (this.waveActive) {
      this.waveTime += dt;
      if (this.waveTime > 5.0) {
        this.waveActive = false;
      }
    }

    // Reaction auto-decay
    if (this.reactionTimer > 2.5 && this.currentReaction !== 'idle') {
      this.currentReaction = 'idle';
    }

    // State auto-decay back to idle/engaged
    if (this.stateTimer > 8.0 && this.currentState !== 'engaged' && this.currentState !== 'idle') {
      this.setState(this.excitementLevel > 0.4 ? 'engaged' : 'idle');
    }

    // Update each tier
    for (let ti = 0; ti < this.tiers.length; ti++) {
      this.updateTier(ti, dt);
    }
  }

  // ── Internals ──

  private updateTier(tierIndex: number, _dt: number) {
    const tier = this.tiers[tierIndex]!;
    const dummy = new THREE.Object3D();

    const start = tier.currentBatch * tier.batchSize;
    const end = Math.min(tier.mesh.count, start + tier.batchSize);

    for (let i = start; i < end; i++) {
      tier.mesh.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      const angle = tier.angles[i]!;
      const baseHeight = tier.heights[i]!;
      const offset = tier.timeOffsets[i]!;

      let yScale = baseHeight;
      let yOffset = 0;
      let xRotOffset = 0;
      let zRotOffset = 0;

      // ── Wave Logic ──
      if (this.waveActive) {
        let waveInfluence = 0;
        const waveFront = this.waveTime * 3.5; // propagation speed

        if (this.waveType === 'mexican' || (this.waveType === 'directional' && this.waveDirection === 'radial')) {
          // Classic circular sweep
          const dist = Math.abs(((angle - this.waveTime * 2.5) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
          waveInfluence = Math.max(0, 1 - dist / 0.8);
        } else if (this.waveType === 'directional') {
          // Directional sweep (left/right based on angle)
          const angleDiff = this.waveDirection === 'right' ? angle : (Math.PI * 2 - angle);
          const dist = Math.abs((angleDiff - waveFront) % (Math.PI * 2));
          waveInfluence = Math.max(0, 1 - dist / 1.2);
        }

        yScale = baseHeight + waveInfluence * 0.65;
        yOffset = waveInfluence * 0.45;
      }
      // ── Reaction & State Logic ──
      else {
        // State base scale/tilt
        switch (this.currentState) {
          case 'engaged':
            xRotOffset = -0.12; // lean forward
            yScale *= 1.05;
            break;
          case 'hyped':
            xRotOffset = -0.18;
            yScale *= 1.15;
            zRotOffset = Math.sin(this.time * 6 + offset) * 0.08; // vibrating excitement
            break;
          case 'shocked':
            xRotOffset = 0.25; // lean back/hunch
            yScale *= 0.85;
            break;
          case 'celebration':
            yScale *= 1.1 + Math.sin(this.time * 12 + offset) * 0.15; // constant jumping
            yOffset = Math.max(0, Math.sin(this.time * 12 + offset)) * 0.3;
            break;
        }

        // Reaction additive
        switch (this.currentReaction) {
          case 'jump': {
            const jumpAmp = (2 - tierIndex) * 0.45;
            const jumpWave = Math.sin(this.time * 10 + offset) * 0.5 + 0.5;
            yScale += jumpWave * jumpAmp * Math.max(0.3, 1 - this.reactionTimer * 0.5);
            yOffset += jumpWave * 0.25 * jumpAmp;
            break;
          }
          case 'clap': {
            const clapRate = 14 + tierIndex * 2;
            const clapAmp = 0.2 * (1 - tierIndex * 0.3);
            dummy.scale.x = 1 + Math.sin(this.time * clapRate + offset) * clapAmp;
            break;
          }
          case 'dismay': {
            const dismayFactor = Math.min(1, this.reactionTimer * 1.2);
            yScale *= (1 - dismayFactor * 0.35);
            xRotOffset += dismayFactor * 0.3; // hunch more
            break;
          }
          case 'idle':
          default: {
            const swayAmp = this.excitementLevel * 0.6 + (this.currentState === 'engaged' ? 0.2 : 0.1);
            const sway = (Math.sin(angle * 5 - this.time * (1.8 + this.excitementLevel * 4) + offset) + 1) * 0.5;
            yScale += sway * swayAmp * 0.45;
            break;
          }
        }
      }

      dummy.scale.y = yScale;
      dummy.position.y += yOffset;
      // Reset rotation and apply offsets
      dummy.lookAt(0, dummy.position.y, 0);
      dummy.rotateX(xRotOffset);
      dummy.rotateZ(zRotOffset);

      dummy.updateMatrix();
      tier.mesh.setMatrixAt(i, dummy.matrix);
    }

    tier.mesh.instanceMatrix.needsUpdate = true;
    tier.currentBatch = (tier.currentBatch + 1) % 3;
  }
}
