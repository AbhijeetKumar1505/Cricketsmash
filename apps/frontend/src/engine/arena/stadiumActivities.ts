import * as THREE from 'three';

// ─── Flash Photography System ────────────────────────────────────────────────

const FLASH_COUNT = 35;
const FLASH_RADIUS_MIN = 55;
const FLASH_RADIUS_MAX = 80;
const FLASH_Y_MIN = 15;
const FLASH_Y_MAX = 32;
const FLASH_DURATION = 0.08; // seconds
const FLASH_COOLDOWN_MIN = 1.5;
const FLASH_COOLDOWN_MAX = 6.0;

interface FlashState {
  position: THREE.Vector3;
  timer: number;
  cooldown: number;
  active: boolean;
}

// ─── Flag System ─────────────────────────────────────────────────────────────

const FLAG_COUNT = 24;
const FLAG_COLORS = [0xffffff, 0x00ccff, 0xffcc00];

interface FlagState {
  mesh: THREE.Mesh;
  baseY: number;
  speed: number;
  phase: number;
}

// ─── Special Fan System (Micro-Stories) ──────────────────────────────────────

const SPECIAL_FAN_COUNT = 15;
const SIGNS = [
  { text: 'MARRY ME!', color: '#ff66aa' },
  { text: 'DEAD BULL = 0 ENERGY', color: '#ffd700' },
  { text: 'BOKA > BURPSI', color: '#ff3333' },
  { text: 'DON\'T DO IT!', color: '#ffffff' },
  { text: 'SEND HELP', color: '#00ff44' },
  { text: 'CASH OUT NOW!', color: '#ffcc00' },
];

interface SpecialFan {
  mesh: THREE.Mesh;
  type: 'selfie' | 'sign' | 'sleeping';
  timer: number;
  cooldown: number;
  baseY: number;
  baseAngle: number;
}

// ─── Laser System ────────────────────────────────────────────────────────────

const LASER_COUNT = 8;
const LASER_COLORS = [0x00ffff, 0xff00ff, 0x00ff00, 0xffff00];

interface Laser {
  mesh: THREE.Mesh;
  origin: THREE.Vector3;
  target: THREE.Vector3;
  active: boolean;
  timer: number;
}

// ─── Confetti & Spotlight Constants ────────────────────────────────────────

const MAX_CONFETTI = 1200;
const CONFETTI_COLORS = [0xffffff, 0xffff00, 0xff00ff, 0x00ffff, 0xff5555];
const SPOTLIGHT_SWEEP_DURATION = 4.5;

// ─── Main System ─────────────────────────────────────────────────────────────

export class StadiumActivitySystem {
  readonly group: THREE.Group;

  // Flash photography
  private flashPoints: THREE.Points;
  private flashStates: FlashState[] = [];
  private flashPositions: Float32Array;
  private flashColors: Float32Array;

  // Flags
  private flags: FlagState[] = [];

  // Special Fans
  private specialFans: SpecialFan[] = [];

  // Lasers
  private lasers: Laser[] = [];
  private laserActive = false;
  private laserTimer = 0;

  // Phone flashlights (far tier shimmer)
  private phoneLights: THREE.Points;
  private phoneLightData: Float32Array;
  private phoneLightTimers: Float32Array;

  // Confetti
  private confetti: THREE.Points;
  private confettiPositions: Float32Array;
  private confettiVelocities: Float32Array;
  private confettiLives: Float32Array;
  private confettiColors: Float32Array;
  private confettiWrite = 0;

  // Spotlights
  private spotlightA: THREE.SpotLight;
  private spotlightB: THREE.SpotLight;
  private spotlightTargetA: THREE.Object3D;
  private spotlightTargetB: THREE.Object3D;
  private spotlightActive = false;
  private spotlightTimer = 0;

  // Global
  private time = 0;
  private excitement = 0;

  constructor() {
    this.group = new THREE.Group();

    // ── Flash Photography Points ──
    this.flashPositions = new Float32Array(FLASH_COUNT * 3);
    this.flashColors = new Float32Array(FLASH_COUNT * 3);
    const flashGeo = new THREE.BufferGeometry();
    flashGeo.setAttribute('position', new THREE.BufferAttribute(this.flashPositions, 3));
    flashGeo.setAttribute('color', new THREE.BufferAttribute(this.flashColors, 3));

    const flashMat = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.flashPoints = new THREE.Points(flashGeo, flashMat);
    this.flashPoints.frustumCulled = false;
    this.group.add(this.flashPoints);

    for (let i = 0; i < FLASH_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = FLASH_RADIUS_MIN + Math.random() * (FLASH_RADIUS_MAX - FLASH_RADIUS_MIN);
      const y = FLASH_Y_MIN + Math.random() * (FLASH_Y_MAX - FLASH_Y_MIN);
      const pos = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);

      const i3 = i * 3;
      this.flashPositions[i3] = pos.x;
      this.flashPositions[i3 + 1] = pos.y;
      this.flashPositions[i3 + 2] = pos.z;
      this.flashColors[i3] = 0;
      this.flashColors[i3 + 1] = 0;
      this.flashColors[i3 + 2] = 0;

      this.flashStates.push({
        position: pos,
        timer: 0,
        cooldown: FLASH_COOLDOWN_MIN + Math.random() * (FLASH_COOLDOWN_MAX - FLASH_COOLDOWN_MIN),
        active: false,
      });
    }

    // ── Special Fans (Hero Sprites) ──
    for (let i = 0; i < SPECIAL_FAN_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 42 + Math.random() * 15;
      const y = 5 + Math.random() * 10;
      const type = i % 3 === 0 ? 'sign' : i % 3 === 1 ? 'selfie' : 'sleeping';

      const geo = new THREE.PlaneGeometry(0.5, 0.5);
      let mat: THREE.MeshBasicMaterial;

      if (type === 'sign') {
        const sign = SIGNS[Math.floor(Math.random() * SIGNS.length)]!;
        mat = new THREE.MeshBasicMaterial({
          map: this.createSignTexture(sign.text, sign.color),
          transparent: true,
          side: THREE.DoubleSide,
        });
      } else {
        mat = new THREE.MeshBasicMaterial({
          color: type === 'sleeping' ? 0x444466 : 0xffffff,
          transparent: true,
          opacity: 0.8,
        });
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      mesh.lookAt(0, y, 0);
      this.group.add(mesh);

      this.specialFans.push({
        mesh,
        type,
        timer: 0,
        cooldown: 2 + Math.random() * 10,
        baseY: y,
        baseAngle: angle,
      });
    }

    // ── Lasers ──
    for (let i = 0; i < LASER_COUNT; i++) {
      const geo = new THREE.CylinderGeometry(0.04, 0.04, 80, 4);
      const color = LASER_COLORS[i % LASER_COLORS.length]!;
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const origin = new THREE.Vector3(
        (i % 2 === 0 ? -1 : 1) * 35,
        38,
        (i < 4 ? -1 : 1) * 35
      );
      this.group.add(mesh);
      this.lasers.push({ mesh, origin, target: new THREE.Vector3(), active: false, timer: 0 });
    }

    // ── Flag Wavers ──
    for (let i = 0; i < FLAG_COUNT; i++) {
      const angle = (i / FLAG_COUNT) * Math.PI * 2 + Math.random() * 0.3;
      const radius = 44 + Math.random() * 12;
      const y = 8 + Math.random() * 10;
      const geo = new THREE.PlaneGeometry(0.8, 1.2);
      const color = FLAG_COLORS[i % FLAG_COLORS.length]!;
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      mesh.lookAt(0, y, 0);
      this.group.add(mesh);
      this.flags.push({ mesh, baseY: y, speed: 2.5 + Math.random() * 2, phase: Math.random() * Math.PI * 2 });
    }

    // ── Phone Flashlights ──
    const phoneCount = 50;
    this.phoneLightData = new Float32Array(phoneCount * 3);
    this.phoneLightTimers = new Float32Array(phoneCount);
    const phoneGeo = new THREE.BufferGeometry();
    for (let i = 0; i < phoneCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 68 + Math.random() * 14;
      const y = 22 + Math.random() * 12;
      const i3 = i * 3;
      this.phoneLightData[i3] = Math.cos(angle) * radius;
      this.phoneLightData[i3 + 1] = y;
      this.phoneLightData[i3 + 2] = Math.sin(angle) * radius;
      this.phoneLightTimers[i] = Math.random() * 10;
    }
    phoneGeo.setAttribute('position', new THREE.BufferAttribute(this.phoneLightData, 3));
    phoneGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(phoneCount * 3), 3));
    this.phoneLights = new THREE.Points(phoneGeo, new THREE.PointsMaterial({
      size: 0.5, vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    this.group.add(this.phoneLights);

    // ── Confetti ──
    this.confettiPositions = new Float32Array(MAX_CONFETTI * 3);
    this.confettiVelocities = new Float32Array(MAX_CONFETTI * 3);
    this.confettiLives = new Float32Array(MAX_CONFETTI).fill(0);
    this.confettiColors = new Float32Array(MAX_CONFETTI * 3);
    const confGeo = new THREE.BufferGeometry();
    confGeo.setAttribute('position', new THREE.BufferAttribute(this.confettiPositions, 3));
    confGeo.setAttribute('color', new THREE.BufferAttribute(this.confettiColors, 3));
    this.confetti = new THREE.Points(confGeo, new THREE.PointsMaterial({
      size: 0.35, vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    this.group.add(this.confetti);

    // ── Spotlights ──
    this.spotlightTargetA = new THREE.Object3D();
    this.spotlightTargetB = new THREE.Object3D();
    this.group.add(this.spotlightTargetA, this.spotlightTargetB);
    this.spotlightA = new THREE.SpotLight(0xffffff, 0, 120, Math.PI * 0.12, 0.6);
    this.spotlightA.position.set(-35, 38, -35);
    this.spotlightA.target = this.spotlightTargetA;
    this.spotlightB = new THREE.SpotLight(0xccccff, 0, 120, Math.PI * 0.12, 0.6);
    this.spotlightB.position.set(35, 38, 35);
    this.spotlightB.target = this.spotlightTargetB;
    this.group.add(this.spotlightA, this.spotlightB);
  }

  private createSignTexture(text: string, color: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 246, 118);
    ctx.fillStyle = color;
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 75);
    return new THREE.CanvasTexture(canvas);
  }

  // ── Public API ──

  setExcitement(level: number) {
    this.excitement = Math.max(0, Math.min(1, level));
  }

  triggerConfetti() {
    const count = 200;
    for (let i = 0; i < count; i++) {
      const idx = this.confettiWrite % MAX_CONFETTI;
      this.confettiWrite++;
      const i3 = idx * 3;
      this.confettiPositions[i3] = (Math.random() - 0.5) * 12;
      this.confettiPositions[i3 + 1] = 18 + Math.random() * 8;
      this.confettiPositions[i3 + 2] = (Math.random() - 0.5) * 12;
      this.confettiVelocities[i3] = (Math.random() - 0.5) * 8;
      this.confettiVelocities[i3 + 1] = -2 + Math.random() * 3;
      this.confettiVelocities[i3 + 2] = (Math.random() - 0.5) * 8;
      const color = new THREE.Color(CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!);
      this.confettiColors[i3] = color.r; this.confettiColors[i3 + 1] = color.g; this.confettiColors[i3 + 2] = color.b;
      this.confettiLives[idx] = 1;
    }
    this.confetti.geometry.attributes.position!.needsUpdate = true;
    this.confetti.geometry.attributes.color!.needsUpdate = true;
  }

  triggerSpotlightSweep() {
    this.spotlightActive = true;
    this.spotlightTimer = 0;
    this.spotlightA.intensity = 3.0;
    this.spotlightB.intensity = 2.5;
  }

  triggerLasers() {
    this.laserActive = true;
    this.laserTimer = 0;
    for (const l of this.lasers) {
      l.active = true;
      l.timer = 0;
    }
  }

  update(dt: number) {
    this.time += dt;
    this.updateFlashes(dt);
    this.updateFlags(dt);
    this.updateSyncWristbands(dt); // Updated naming for Phone Lights
    this.updateConfetti(dt);
    this.updateSpotlights(dt);
    this.updateSpecialFans(dt);
    this.updateLasers(dt);
  }

  private updateFlashes(dt: number) {
    // Flash rate increases exponentially with excitement
    const flashRate = 0.4 + Math.pow(this.excitement, 1.8) * 8.0;
    for (let i = 0; i < FLASH_COUNT; i++) {
      const state = this.flashStates[i]!;
      const i3 = i * 3;
      state.timer += dt;
      if (state.active) {
        if (state.timer >= FLASH_DURATION) {
          state.active = false; state.timer = 0;
          state.cooldown = (FLASH_COOLDOWN_MIN + Math.random() * (FLASH_COOLDOWN_MAX - FLASH_COOLDOWN_MIN)) / flashRate;
          this.flashColors[i3] = 0; this.flashColors[i3 + 1] = 0; this.flashColors[i3 + 2] = 0;
        } else {
          const intensity = 1.0 - (state.timer / FLASH_DURATION) * 0.2;
          this.flashColors[i3] = intensity; this.flashColors[i3 + 1] = intensity; this.flashColors[i3 + 2] = intensity;
        }
      } else if (state.timer >= state.cooldown) {
        state.active = true; state.timer = 0;
      }
    }
    this.flashPoints.geometry.attributes.color!.needsUpdate = true;
  }

  private updateFlags(_dt: number) {
    for (const flag of this.flags) {
      const amp = 0.15 + this.excitement * 0.4;
      const wave = Math.sin(this.time * flag.speed + flag.phase);
      flag.mesh.rotation.z = wave * amp;
      flag.mesh.position.y = flag.baseY + Math.sin(this.time * flag.speed * 0.5 + flag.phase) * 0.2;
    }
  }

  private updateSpecialFans(dt: number) {
    for (const fan of this.specialFans) {
      fan.timer += dt;
      if (fan.type === 'sign') {
        const wave = Math.sin(this.time * 3 + fan.mesh.id) * 0.1;
        fan.mesh.position.y = fan.baseY + wave;
        fan.mesh.rotation.z = wave * 0.5;
      } else if (fan.type === 'selfie') {
        if (fan.timer >= fan.cooldown) {
          fan.timer = 0;
          fan.cooldown = 3 + Math.random() * 8;
          // Trigger a local flash? (Already handled by global flashes for now)
        }
      } else if (fan.type === 'sleeping') {
        if (this.excitement > 0.8) {
          fan.mesh.position.y = fan.baseY + Math.abs(Math.sin(this.time * 10)) * 0.5;
        } else {
          fan.mesh.position.y = fan.baseY;
        }
      }
    }
  }

  private updateLasers(dt: number) {
    if (!this.laserActive) return;
    this.laserTimer += dt;
    if (this.laserTimer > 6.0) {
      this.laserActive = false;
      for (const l of this.lasers) (l.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
      return;
    }
    for (let i = 0; i < LASER_COUNT; i++) {
      const l = this.lasers[i]!;
      l.timer += dt;
      const opacity = 0.4 + Math.sin(this.time * 20 + i) * 0.3;
      (l.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;

      // Random jitter sweep
      l.target.set(
        Math.sin(this.time * 2 + i) * 30,
        0,
        Math.cos(this.time * 2 + i) * 30
      );
      l.mesh.position.copy(l.origin).add(l.target).multiplyScalar(0.5);
      l.mesh.lookAt(l.target);
      l.mesh.rotateX(Math.PI / 2);
    }
  }

  private updateSyncWristbands(dt: number) {
    const colors = this.phoneLights.geometry.attributes.color!.array as Float32Array;
    const count = this.phoneLightTimers.length;

    // Wristband color shifts with multiplier excitement
    const wristColor = new THREE.Color();
    if (this.excitement > 0.8) wristColor.set('#ff00ff');      // Neon Magenta
    else if (this.excitement > 0.5) wristColor.set('#00ffff'); // Neon Cyan
    else if (this.excitement > 0.2) wristColor.set('#00ff88'); // Neon Green
    else wristColor.set('#ffffff');                           // Pure white

    for (let i = 0; i < count; i++) {
      this.phoneLightTimers[i] += dt;
      const i3 = i * 3;
      const t = this.phoneLightTimers[i]!;
      
      // Pattern sync wave through the stadium
      const angle = Math.atan2(this.phoneLightData[i3+2]!, this.phoneLightData[i3]!);
      const wave = Math.sin(this.time * 2.0 + angle * 4.0);
      
      const pattern = Math.sin(t * 1.5 + i * 3.5) + (this.excitement * 0.8);
      const isGlowing = pattern > (0.6 - this.excitement * 0.4);

      if (isGlowing) {
        const intensity = 0.5 + wave * 0.3 + this.excitement * 0.5;
        colors[i3] = wristColor.r * intensity; 
        colors[i3 + 1] = wristColor.g * intensity; 
        colors[i3 + 2] = wristColor.b * intensity;
      } else {
        colors[i3] = 0; colors[i3 + 1] = 0; colors[i3 + 2] = 0;
      }
    }
    this.phoneLights.geometry.attributes.color!.needsUpdate = true;
  }

  private updateConfetti(dt: number) {
    let alive = 0; const wind = Math.sin(this.time * 0.7) * 1.5;
    for (let i = 0; i < MAX_CONFETTI; i++) {
      if (this.confettiLives[i]! <= 0) { this.confettiPositions[i * 3 + 1] = -999; continue; }
      alive++; const i3 = i * 3;
      this.confettiLives[i] -= dt * 0.25; this.confettiVelocities[i3 + 1]! -= 4.5 * dt;
      this.confettiPositions[i3] += (this.confettiVelocities[i3]! + wind) * dt;
      this.confettiPositions[i3 + 1] += this.confettiVelocities[i3 + 1]! * dt;
      this.confettiPositions[i3 + 2] += this.confettiVelocities[i3 + 2]! * dt;
      this.confettiVelocities[i3] *= 1 - dt * 1.2; this.confettiVelocities[i3 + 2] *= 1 - dt * 1.2;
      this.confettiPositions[i3] += Math.sin(this.time * 8 + i * 2.7) * 0.02;
    }
    this.confetti.visible = alive > 0;
    this.confetti.geometry.attributes.position!.needsUpdate = true;
  }

  private updateSpotlights(dt: number) {
    if (!this.spotlightActive) return;
    this.spotlightTimer += dt;
    const progress = this.spotlightTimer / SPOTLIGHT_SWEEP_DURATION;
    if (progress >= 1) { this.spotlightActive = false; this.spotlightA.intensity = 0; this.spotlightB.intensity = 0; return; }
    const angleA = progress * Math.PI * 1.5; const angleB = Math.PI + progress * Math.PI * 1.5; const sweepR = 50;
    this.spotlightTargetA.position.set(Math.cos(angleA) * sweepR, 8, Math.sin(angleA) * sweepR);
    this.spotlightTargetB.position.set(Math.cos(angleB) * sweepR, 8, Math.sin(angleB) * sweepR);
    const fade = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
    this.spotlightA.intensity = 3.0 * fade; this.spotlightB.intensity = 2.5 * fade;
  }

  dispose() {
    this.spotlightA.dispose(); this.spotlightB.dispose();
    for (const fan of this.specialFans) (fan.mesh.material as THREE.Material).dispose();
    for (const l of this.lasers) (l.mesh.material as THREE.Material).dispose();
  }
}
