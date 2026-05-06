import * as THREE from 'three';
import type { BonusSnapshot } from '../../engine/bonus/types.js';

const CORE_VERT = `
varying vec3 vNormalW;
varying vec3 vViewDirW;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDirW = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const CORE_FRAG = `
uniform vec3 uBaseColor;
uniform vec3 uEmissiveColor;
uniform float uTime;
uniform float uPulseSpeed;
uniform float uGlowIntensity;
uniform float uRarityTier;
varying vec3 vNormalW;
varying vec3 vViewDirW;
void main() {
  float rim = pow(1.0 - max(dot(normalize(vNormalW), normalize(vViewDirW)), 0.0), 2.35);
  float pulse = 0.72 + 0.28 * sin(uTime * uPulseSpeed);
  float rarityBoost = 1.0 + uRarityTier * 0.32;
  /** Strong always-on fill so distant props read as tinted capsules, not black dots. */
  vec3 lit = uBaseColor * (0.62 + 0.38 * pulse) * rarityBoost;
  vec3 glow = uEmissiveColor * rim * uGlowIntensity * pulse * rarityBoost;
  gl_FragColor = vec4(lit + glow, 1.0);
}
`;

const AURA_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const AURA_FRAG = `
uniform vec3 uEmissiveColor;
uniform float uTime;
uniform float uGlowIntensity;
uniform float uPulseSpeed;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float d = length(p) * 2.0;
  float ring = smoothstep(0.95, 0.35, d);
  float pulse = 0.65 + 0.35 * sin(uTime * uPulseSpeed + d * 5.0);
  float alpha = ring * pulse * uGlowIntensity * 0.72;
  gl_FragColor = vec4(uEmissiveColor, alpha);
}
`;

function rarityToFloat(tier: BonusSnapshot['rarityTier']): number {
  return tier === 'legendary' ? 3 : tier === 'epic' ? 2 : tier === 'rare' ? 1 : 0;
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

type PropKind = 'stands' | 'spider' | 'rover' | 'paint';

function bonusGlowPalette(snap: BonusSnapshot): { baseHex: number; glowHex: number; pulse: number } {
  if (snap.visual === 'rover')
    return { baseHex: 0xff7836, glowHex: 0xffd0a8, pulse: 2.85 };
  if (snap.visual === 'spider')
    return { baseHex: 0x12d8ff, glowHex: 0xc6fbff, pulse: 2.95 };
  if (snap.extraBalls >= 3) return { baseHex: 0xffc935, glowHex: 0xfff4c4, pulse: 2.5 };
  if (snap.extraBalls >= 2) return { baseHex: 0x45e0ff, glowHex: 0xdcfcff, pulse: 2.35 };
  if (snap.zone === 'stands' && snap.y > 3.2)
    return { baseHex: 0x62ff95, glowHex: 0xe4ffee, pulse: 2.55 }; // skyline +ball hoardings
  return { baseHex: 0xffe057, glowHex: 0xfff8d8, pulse: 2.25 };
}

/** MeshBasic-heavy props so distant lighting never washes them to black. */
export class BonusObject3D {
  readonly root = new THREE.Group();
  private readonly core: THREE.Mesh;
  private readonly propRoot = new THREE.Group();
  private readonly aura: THREE.Mesh;
  private readonly coreMat: THREE.ShaderMaterial;
  private readonly auraMat: THREE.ShaderMaterial;
  private readonly snap: BonusSnapshot;
  private readonly animSeed: number;
  private readonly propKind: PropKind;
  /** Upper-stand hoardings — larger silhouette. */
  private readonly isSkyHoard: boolean;

  private spiderDolly: THREE.Group | null = null;
  private roverWheels: THREE.Mesh[] = [];

  /** Broadcast camera-ish eye position for billboard aura (see `render/Camera.ts`). */
  private static readonly _CAM_LOOK = new THREE.Vector3(0, 3.72, 10);
  private static readonly _TMP_LOOK = new THREE.Vector3();

  constructor(snap: BonusSnapshot) {
    this.snap = snap;
    this.animSeed = hashId(snap.id) * 0.01;
    /** Upper skyline band only — mid-stand bonuses use shorter posts / boards. */
    this.isSkyHoard = snap.visual === 'hoarding' && snap.zone === 'stands' && snap.y >= 5.85;
    this.propKind =
      snap.visual === 'hoarding' ? 'stands'
      : snap.visual === 'spider' ? 'spider'
      : snap.visual === 'rover' ? 'rover'
      : 'paint';

    const palette = bonusGlowPalette(snap);
    const geo = new THREE.SphereGeometry(0.156, 16, 14);
    this.coreMat = new THREE.ShaderMaterial({
      vertexShader: CORE_VERT,
      fragmentShader: CORE_FRAG,
      uniforms: {
        uBaseColor: { value: new THREE.Color(palette.baseHex) },
        uEmissiveColor: { value: new THREE.Color(palette.glowHex) },
        uTime: { value: 0 },
        uPulseSpeed: { value: palette.pulse },
        uGlowIntensity: { value: Math.min(2.85, snap.intensity + 0.82) },
        uRarityTier: { value: rarityToFloat(snap.rarityTier) },
      },
    });
    this.core = new THREE.Mesh(geo, this.coreMat);

    this.auraMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: AURA_VERT,
      fragmentShader: AURA_FRAG,
      uniforms: {
        uEmissiveColor: { value: (this.coreMat.uniforms.uEmissiveColor.value as THREE.Color).clone() },
        uTime: { value: 0 },
        uGlowIntensity: { value: snap.intensity + 1.05 },
        uPulseSpeed: { value: palette.pulse * 0.88 },
      },
    });
    this.aura = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 1.92), this.auraMat);

    this.root.add(this.propRoot);
    this.buildGroundProp();

    this.propRoot.rotation.y =
      snap.visual === 'hoarding' ? Math.atan2(-snap.x, -(snap.z - 0.2)) : 0;

    if (!this.core.parent) {
      this.core.position.y = 0.55;
      this.aura.position.y = 0.04;
      this.root.add(this.core, this.aura);
    }
    this.root.position.set(snap.x, snap.y, snap.z);
  }

  update(time: number, dt: number, activeHit: boolean, snap: BonusSnapshot): void {
    this.root.position.set(snap.x, snap.y, snap.z);

    const pulse = activeHit ? 1.35 : 1;
    const t = time + this.animSeed;
    const sway = Math.sin(t * 2.4 + this.animSeed) * 0.035;

    switch (this.propKind) {
      case 'spider': {
        const dolly = this.spiderDolly;
        if (dolly) {
          /** Slower glide = less twitch vs world-space roam velocities. */
          const glide = Math.sin(t * 2.05) * 0.2;
          const bob = Math.sin(t * 1.85) * 0.035;
          dolly.position.x = glide;
          dolly.position.y = 1.1 + bob;
          dolly.position.z = Math.sin(t * 1.7) * 0.038;
          dolly.rotation.z = Math.sin(t * 0.55) * 0.045;
        }
        break;
      }
      case 'rover': {
        const spd = Math.hypot(snap.vx, snap.vz);
        if (spd > 0.028) {
          const ty = Math.atan2(-snap.vx, -snap.vz);
          const cur = this.propRoot.rotation.y;
          let delta = ty - cur;
          delta -= Math.round(delta / (Math.PI * 2)) * Math.PI * 2;
          this.propRoot.rotation.y = cur + delta * Math.min(1, spd * dt * 2.5);
        }
        const rollMag = spd * dt * 2.15;
        for (const w of this.roverWheels) {
          w.rotation.x += rollMag;
        }
        this.core.rotation.y += dt * 0.75;
        break;
      }
      case 'stands':
        this.propRoot.rotation.y = Math.atan2(-snap.x, -snap.z);
        this.core.rotation.y += dt * 1.15;
        break;
      case 'paint':
        {
          const hover = sway + 0.02;
          this.core.position.y = 0.55 + hover;
        }
        this.core.rotation.y += dt * 0.95;
        break;
      default:
        break;
    }

    if (this.propKind === 'spider') {
      this.core.rotation.y += dt * 0.72;
    }

    const auraParent = this.aura.parent ?? this.root;
    BonusObject3D._TMP_LOOK.copy(BonusObject3D._CAM_LOOK);
    auraParent.worldToLocal(BonusObject3D._TMP_LOOK);
    this.aura.lookAt(BonusObject3D._TMP_LOOK);
    this.coreMat.uniforms.uTime.value = time;
    this.auraMat.uniforms.uTime.value = time;
    const baseGlow = Math.min(3.0, 0.95 + this.snap.intensity * 0.62);
    this.coreMat.uniforms.uGlowIntensity.value = baseGlow * pulse;
    this.auraMat.uniforms.uGlowIntensity.value = (baseGlow + 0.28) * pulse;
  }

  dispose(): void {
    this.propRoot.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj === this.core || obj === this.aura) return;
      obj.geometry.dispose();
      const m = obj.material;
      if (Array.isArray(m)) {
        for (const mm of m) mm.dispose();
      } else {
        m.dispose();
      }
    });
    this.core.geometry.dispose();
    this.aura.geometry.dispose();
    this.coreMat.dispose();
    this.auraMat.dispose();
  }

  private buildGroundProp(): void {
    if (this.propKind === 'stands') {
      const mastMat = new THREE.MeshBasicMaterial({ color: 0x495a6b });
      const lampFrameMat = new THREE.MeshBasicMaterial({ color: 0x2f3f4f });
      const lampGlowMat = new THREE.MeshBasicMaterial({
        color: this.isSkyHoard ? 0xc8f5ff : 0xb8ebff,
        transparent: true,
        opacity: 0.98,
      });

      const mastH = this.isSkyHoard ? 1.96 : 1.52;
      const mastY = this.isSkyHoard ? -0.18 : -0.08;
      const mastOffset = this.isSkyHoard ? 0.94 : 0.82;

      const mastL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, mastH, 10), mastMat);
      mastL.position.set(-mastOffset, mastY, 0);
      const mastR = mastL.clone();
      mastR.position.x = mastOffset;

      const topY = mastY + mastH * 0.5;
      const archRadius = this.isSkyHoard ? 0.94 : 0.82;
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(archRadius, 0.055, 10, 24, Math.PI),
        lampFrameMat,
      );
      arch.rotation.z = Math.PI;
      arch.position.set(0, topY + 0.08, 0.03);

      const lampCount = this.isSkyHoard ? 5 : 4;
      for (let i = 0; i < lampCount; i++) {
        const t = i / (lampCount - 1);
        const x = (t - 0.5) * (archRadius * 1.8);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.1), lampFrameMat);
        const yCurve = topY + 0.02 + Math.cos((t - 0.5) * Math.PI) * 0.14;
        lamp.position.set(x, yCurve - 0.11, 0.08);
        const lampGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.1), lampGlowMat);
        lampGlow.position.set(x, yCurve - 0.13, 0.155);
        this.propRoot.add(lamp, lampGlow);
      }

      const topCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0x9db7cb }),
      );
      topCap.position.set(0, topY + 0.22, 0.02);

      this.core.scale.setScalar(this.isSkyHoard ? 0.58 : 0.54);
      this.core.position.set(0, topY + 0.32, 0.1);
      this.aura.scale.setScalar(this.isSkyHoard ? 1.14 : 1.02);
      this.aura.position.set(0, topY + 0.34, 0.12);

      this.propRoot.add(mastL, mastR, arch, topCap, this.core, this.aura);
      return;
    }

    if (this.propKind === 'spider') {
      const cableMat = new THREE.MeshBasicMaterial({ color: 0xe8eef7 });
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.85, 8), cableMat);
      cable.rotation.z = Math.PI / 2;
      cable.position.set(0, 1.18, 0);

      const dolly = new THREE.Group();
      dolly.position.set(0, 1.1, 0);
      this.spiderDolly = dolly;

      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.028, 0.42, 8),
        new THREE.MeshBasicMaterial({ color: 0xc5d4e8 }),
      );
      stalk.position.y = -0.1;

      const hullMat = new THREE.MeshBasicMaterial({ color: 0x9ee7ff });
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.26), hullMat);
      hull.rotation.x = Math.PI / 2.85;
      hull.rotation.z = Math.PI / 18;
      hull.position.y = -0.36;

      const podMat = new THREE.MeshBasicMaterial({ color: 0x00a8e8 });
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.055, 14), podMat);
      lens.rotation.z = Math.PI / 2;
      lens.position.set(0.19, -0.34, 0.02);

      const rimMat = new THREE.MeshBasicMaterial({ color: 0xffdd55 });
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.018, 8, 22), rimMat);
      rim.rotation.y = Math.PI / 2;
      rim.position.set(0.21, -0.34, 0.02);

      dolly.add(stalk, hull, lens, rim);

      const legMat = new THREE.MeshBasicMaterial({ color: 0x9eb4d0 });
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.48, 6), legMat);
        const a = (i / 4) * Math.PI * 2;
        leg.position.set(Math.cos(a) * 0.14, -0.68, Math.sin(a) * 0.14);
        leg.rotation.x = Math.PI * 0.08;
        leg.rotation.z = Math.cos(a) * 0.12;
        dolly.add(leg);
      }

      this.core.scale.setScalar(0.76);
      this.core.position.set(-0.035, -0.295, 0.065);
      this.aura.scale.setScalar(0.98);
      this.aura.position.set(0.03, -0.175, 0.11);
      dolly.add(this.core, this.aura);

      this.propRoot.add(cable, dolly);
      return;
    }

    if (this.propKind === 'rover') {
      const bodyMat = new THREE.MeshBasicMaterial({ color: 0x7ebfff });
      const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.22, 0.48),
        bodyMat,
      );
      chassis.position.y = 0.18;

      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xff8c42 });
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.055, 0.5), stripeMat);
      stripe.position.set(0, 0.22, 0);

      const wheelMatOuter = new THREE.MeshBasicMaterial({ color: 0x5d6f82 });
      const wheelMatTire = new THREE.MeshBasicMaterial({ color: 0x22303d });

      for (const xz of ([[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]] as const)) {
        const [ox, oz] = xz;
        const tire = new THREE.Mesh(
          new THREE.TorusGeometry(0.088, 0.028, 8, 16),
          wheelMatOuter,
        );
        tire.rotation.y = Math.PI / 2;
        tire.position.set(ox, 0.086, oz);
        const hub = new THREE.Mesh(
          new THREE.CircleGeometry(0.05, 10),
          wheelMatTire,
        );
        hub.rotation.y = Math.PI / 2;
        hub.position.set(ox > 0 ? ox + 0.02 : ox - 0.02, 0.086, oz);
        this.roverWheels.push(tire);
        this.propRoot.add(tire, hub);
      }

      this.core.scale.setScalar(1.02);
      this.core.position.set(0.035, 0.33, -0.025);
      this.aura.scale.setScalar(1.2);
      this.aura.position.set(0.02, 0.495, 0.02);

      this.propRoot.add(stripe, chassis, this.core, this.aura);
      return;
    }

    const paintMat = new THREE.MeshBasicMaterial({ color: 0xffcf5a, transparent: true, opacity: 0.88 });
    const paint = new THREE.Mesh(new THREE.CircleGeometry(0.72, 40), paintMat);
    paint.rotation.x = -Math.PI / 2;
    paint.position.y = 0.02;
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.76, 0.84, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.021;
    this.propRoot.add(ring, paint);
  }
}
