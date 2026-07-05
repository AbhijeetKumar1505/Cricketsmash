import * as THREE from 'three';
import { WORLD } from '../../engine/constants.js';
import { GameState } from '../../engine/state/StateMachine.js';
import { SponsorBannerSystem } from '../../engine/arena/sponsorBanners.js';
import { StadiumActivitySystem } from '../../engine/arena/stadiumActivities.js';
import type { DoodleAssets } from '../doodle/DoodleAssets.js';

const MID_Z = (WORLD.STUMPS_FAR_Z + WORLD.STUMPS_NEAR_Z) / 2;
const PITCH_LEN = Math.abs(WORLD.STUMPS_FAR_Z - WORLD.STUMPS_NEAR_Z);
const STAND_SECTIONS = 32;
const INNER_R = 18;
const TIER_STEP_R = 2.4;
const TIER_STEP_H = 1.5;
const TIERS = 2;
const PEOPLE_PER_TIER = 7;
const BOUNDARY_R = 14;
const SKIP_SIN_THRESHOLD = 0.45;

/**
 * Boundary sponsor hoardings — world Y is explicit so boards sit above the rope / turf
 * (planes were effectively floor-skinned at ~0.5 m centre).
 */
const BOUNDARY_HOARDING = {
  /** Number of vertical bands (e.g. lower + upper stack like real stadium boards). */
  rows: [
    /** Y nudged to wheat-fence pivot (1.2); posts lengthened slightly so planks read anchored. */
    { centerY: 0.5, boardW: 3.72, boardH: 0.82, postDepth: 0.65, postYOffset: -0.6 },
  ] as const,
  /** Just infield of `buildWheatFence` (~BOUNDARY_R+1.2) so boards sit on the pole line, not floating inside. */
  radius: BOUNDARY_R + 1.14,
  lookTargetYBias: 0.035,
} as const;

const SPONSORS: { name: string; bg: string; fg: string }[] = [
  { name: 'Boka Cola', bg: '#d83f43', fg: '#ffffff' },
  { name: 'Burpsi', bg: '#3076d3', fg: '#ffffff' },
  { name: 'Dead Bull', bg: '#262626', fg: '#ffb347' },
  { name: "Lazy's", bg: '#ffd84e', fg: '#a16400' },
  { name: "Doridon'ts", bg: '#71c856', fg: '#ffffff' },
  { name: 'Niko', bg: '#ff9956', fg: '#ffffff' },
  { name: 'Badidas', bg: '#3f3f3f', fg: '#ffffff' },
  { name: 'Looma', bg: '#ffc85a', fg: '#6c4d00' },
  { name: 'No Balance', bg: '#78b6ef', fg: '#ffffff' },
  { name: 'Weakbok', bg: '#6e91d8', fg: '#ffffff' },
];

function toTexture(cv: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeOutfieldTexture(): THREE.CanvasTexture {
  const size = 512;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const cx = cv.getContext('2d')!;

  // Super-saturated mowing bands — vivid arcade-stadium green
  const bands = 14;
  const bandH = size / bands;
  for (let i = 0; i < bands; i++) {
    cx.fillStyle = i % 2 === 0 ? '#3ec556' : '#2cae3d';
    cx.fillRect(0, i * bandH, size, bandH);
  }

  // Bright white sheen line between bands
  cx.strokeStyle = 'rgba(255,255,255,0.42)';
  cx.lineWidth = 5;
  for (let i = 1; i < bands; i += 2) {
    cx.beginPath();
    cx.moveTo(0, i * bandH);
    cx.lineTo(size, i * bandH);
    cx.stroke();
  }

  // Subtle noise
  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    cx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.020)' : 'rgba(0,0,0,0.018)';
    cx.fillRect(x, y, 1.6, 1.6);
  }

  const tex = toTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function makePitchTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 1024;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const cx = cv.getContext('2d')!;

  // Rich sun-baked clay base
  cx.fillStyle = '#c9a462';
  cx.fillRect(0, 0, w, h);

  // Worn centre strip — darker where ball lands repeatedly
  const centerGrad = cx.createLinearGradient(w * 0.28, 0, w * 0.72, 0);
  centerGrad.addColorStop(0,   'rgba(110,75,28,0)');
  centerGrad.addColorStop(0.5, 'rgba(110,75,28,0.22)');
  centerGrad.addColorStop(1,   'rgba(110,75,28,0)');
  cx.fillStyle = centerGrad;
  cx.fillRect(0, 0, w, h);

  // Rolling stripes (light sheen from the roller)
  cx.strokeStyle = 'rgba(255,240,200,0.13)';
  cx.lineWidth = 5;
  for (let y = 18; y < h; y += 22) {
    cx.beginPath();
    cx.moveTo(14, y);
    cx.lineTo(w - 14, y);
    cx.stroke();
  }

  // Fine cracks — centre and crease zones
  cx.strokeStyle = 'rgba(90,58,20,0.28)';
  const rng = (n: number) => ((n * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 18; i++) {
    const startX = w * 0.25 + rng(i * 7) * w * 0.5;
    const startY = rng(i * 13) * h;
    cx.lineWidth = 0.8 + rng(i * 5) * 0.8;
    cx.beginPath();
    cx.moveTo(startX, startY);
    let cx2 = startX, cy2 = startY;
    for (let j = 0; j < 4; j++) {
      cx2 += (rng(i * 11 + j) - 0.5) * 28;
      cy2 += (rng(i * 17 + j) - 0.5) * 18;
      cx.lineTo(cx2, cy2);
    }
    cx.stroke();
  }

  // Scuff marks near crease ends (front + back 18% of pitch)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 90; i++) {
      const x = 12 + rng(pass * 200 + i) * (w - 24);
      const baseY = pass === 0 ? rng(pass * 300 + i) * h * 0.18 : h - rng(pass * 300 + i) * h * 0.18;
      const len = 5 + rng(pass * 400 + i) * 14;
      cx.strokeStyle = `rgba(88,58,20,${0.07 + rng(pass * 500 + i) * 0.11})`;
      cx.lineWidth = 0.7 + rng(pass * 600 + i);
      cx.beginPath();
      cx.moveTo(x, baseY);
      cx.lineTo(x + (rng(pass * 700 + i) - 0.5) * len, baseY + rng(pass * 800 + i) * len);
      cx.stroke();
    }
  }

  // Darker edge border
  cx.strokeStyle = 'rgba(80,50,18,0.28)';
  cx.lineWidth = 9;
  cx.strokeRect(10, 10, w - 20, h - 20);

  return toTexture(cv);
}

function makeSponsorTexture(brand: { name: string; bg: string; fg: string }): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 96;
  const cx = cv.getContext('2d')!;

  cx.fillStyle = brand.bg;
  cx.fillRect(0, 0, 256, 96);
  cx.strokeStyle = 'rgba(255,255,255,0.3)';
  cx.lineWidth = 4;
  cx.strokeRect(3, 3, 250, 90);

  cx.fillStyle = brand.fg;
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.font = `bold ${brand.name.length > 12 ? 22 : 28}px Arial, sans-serif`;
  cx.fillText(brand.name, 128, 49);

  return toTexture(cv);
}

function makeScoreboardTexture(
  cv: HTMLCanvasElement,
  winAmount: number,
  multiplier: number,
  currencySym: string,
): void {
  const w = 512;
  const h = 256;
  cv.width = w;
  cv.height = h;
  const cx = cv.getContext('2d')!;

  cx.fillStyle = '#040712';
  cx.fillRect(0, 0, w, h);

  cx.fillStyle = '#0a1024';
  cx.fillRect(18, 18, w - 36, h - 36);
  cx.strokeStyle = '#ffb800';
  cx.lineWidth = 4;
  cx.strokeRect(18, 18, w - 36, h - 36);

  cx.textAlign = 'center';
  cx.textBaseline = 'middle';

  // Title
  cx.shadowBlur = 18;
  cx.shadowColor = '#ffb800';
  cx.fillStyle = '#ffd95a';
  cx.font = 'bold 30px Arial, sans-serif';
  cx.fillText('CRICKET CRASH', w / 2, 62);

  const hasWin = winAmount > 0;
  const isMega = hasWin && multiplier > 3;

  if (!hasWin) {
    // Idle / no win — money-only design, no multipliers
    cx.shadowBlur = 0;
    cx.fillStyle = 'rgba(255, 241, 163, 0.6)';
    cx.font = 'bold 26px Arial, sans-serif';
    cx.fillText('PLACE YOUR BET', w / 2, 158);
    return;
  }

  if (isMega) {
    cx.shadowBlur = 14;
    cx.shadowColor = '#ffd95a';
    cx.fillStyle = '#ffe27a';
    cx.font = 'bold 26px Arial, sans-serif';
    cx.fillText('MEGA WIN', w / 2, 118);
  }

  cx.shadowBlur = 24;
  cx.shadowColor = isMega ? '#ffd95a' : '#00ff99';
  cx.fillStyle = isMega ? '#ffe27a' : '#00ff99';
  const amtText = `${currencySym}${winAmount.toFixed(2)}`;
  cx.font = `bold ${amtText.length > 9 ? 44 : 54}px Arial, sans-serif`;
  cx.fillText(amtText, w / 2, isMega ? 182 : 166);
}

type CrowdSprite = {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  idleTex: THREE.Texture;
  celebTex: THREE.Texture;
  celebrating: boolean;
  basePosition: THREE.Vector3;
  scale: number;
  phase: number;
  angle: number;  // azimuth around pitch centre — drives Mexican-wave propagation
};

type DriftSprite = {
  mesh: THREE.Mesh;
  basePosition: THREE.Vector3;
  phase: number;
};

type TuftSprite = {
  mesh: THREE.Mesh;
  baseY: number;
  phase: number;
};

export class StadiumEntity {
  readonly root: THREE.Group;

  private readonly _crowd = new THREE.Group();
  private readonly _crowdSprites: CrowdSprite[] = [];
  private readonly _clouds: DriftSprite[] = [];
  private readonly _tufts: TuftSprite[] = [];
  private readonly _scoreboardCanvas: HTMLCanvasElement;
  private readonly _scoreboardTex: THREE.CanvasTexture;
  private readonly _sponsorMeshes: THREE.Mesh[] = [];
  private readonly _sponsorTextures: THREE.CanvasTexture[] = [];
  private _time = 0;

  /** LED ribbon + flash/confetti — local origin = pitch centre (parented at `MID_Z`). */
  private readonly _arenaLivingRoot = new THREE.Group();
  private readonly _sponsorRibbon: SponsorBannerSystem;
  private readonly _activities: StadiumActivitySystem;
  /** Extra Mexican-wave amplitude after boundaries (decays). */
  private _crowdWaveBoost = 0;
  /** Countdown in seconds for jump celebration (six/four). */
  private _reactionTimer = 0;

  constructor(assets: DoodleAssets) {
    this.root = new THREE.Group();

    this.buildOutfield();
    this.buildPitch();
    this.buildCreases();
    this.buildStumps(WORLD.STUMPS_NEAR_Z);
    this.buildStumps(WORLD.STUMPS_FAR_Z);
    this.buildBoundaryRope();
    this.buildWheatFence(assets);
    this.buildSponsorBoards();
    this.buildStands();
    this.buildStandRailings();
    this.buildCrowd(assets);
    this.buildFloodlightTowers();
    this.buildForegroundTufts();
    this.buildAtmosphericHaze();

    this._sponsorRibbon = new SponsorBannerSystem();
    this._activities = new StadiumActivitySystem();
    this._arenaLivingRoot.position.set(0, 0, MID_Z);
    this._arenaLivingRoot.add(this._sponsorRibbon.group);
    this._arenaLivingRoot.add(this._activities.group);
    this.root.add(this._arenaLivingRoot);

    this.root.add(this._crowd);

    this._scoreboardCanvas = document.createElement('canvas');
    makeScoreboardTexture(this._scoreboardCanvas, 0, 1, '$');
    this._scoreboardTex = toTexture(this._scoreboardCanvas);
    this.buildScoreboard();
  }

  updateScoreboard(winAmount: number, multiplier: number, currencySym: string): void {
    makeScoreboardTexture(this._scoreboardCanvas, winAmount, multiplier, currencySym);
    this._scoreboardTex.needsUpdate = true;
  }

  /**
   * Drives LED ribbon pulse + living-stadium micro-FX. `enginePhase` is `GameState` string.
   */
  updateAnimations(dt: number, camera: THREE.Camera | undefined, enginePhase: string): void {
    this._time += dt;

    this._crowdWaveBoost = Math.max(0, this._crowdWaveBoost - dt * 0.45);
    this._reactionTimer = Math.max(0, this._reactionTimer - dt);

    const ribbonPhase =
      enginePhase === GameState.BOWLER_RUNUP ||
      enginePhase === GameState.BALL_RELEASE ||
      enginePhase === GameState.BALL_TRAVEL
        ? 'bowl'
        : enginePhase === GameState.HIT || enginePhase === GameState.BALL_RESULT
          ? 'hit'
          : 'idle';
    this._sponsorRibbon.update(dt, ribbonPhase);
    this._activities.update(dt);

    for (const sprite of this._crowdSprites) {
      // Mexican-wave: slow travelling pulse keyed to each sprite's azimuth angle.
      const wave = Math.sin(sprite.angle * 1.8 - this._time * 0.75) * 0.5 + 0.5;
      const bobAmp = 0.06 + 0.14 * this._crowdWaveBoost;
      const bob  = wave * bobAmp + Math.sin(this._time * 1.8 + sprite.phase) * 0.009;
      const sway = Math.sin(this._time * 1.4 + sprite.phase) * 0.022;

      // Staggered jump — ripples around stadium by azimuth so celebration is a wave
      const normalizedAngle = ((sprite.angle / (Math.PI * 2)) + 1) % 1;
      const staggerOffset = normalizedAngle * 0.4;
      const staggeredT = Math.max(0, this._reactionTimer - staggerOffset);
      const jumpT = Math.min(1, staggeredT * 2.5);
      const jumpH = Math.sin(jumpT * Math.PI) * 0.45;

      sprite.mesh.position.set(
        sprite.basePosition.x + sway,
        sprite.basePosition.y + bob + jumpH,
        sprite.basePosition.z + Math.cos(this._time * 1.1 + sprite.phase) * 0.012,
      );
      const scalePulse = 0.05 + 0.12 * this._crowdWaveBoost;
      sprite.mesh.scale.setScalar(sprite.scale * (1 + wave * scalePulse));
      if (camera) sprite.mesh.lookAt(camera.position);

      // Swap texture between idle/celebrate when state changes
      const shouldCelebrate = jumpT > 0.08;
      if (shouldCelebrate !== sprite.celebrating) {
        sprite.celebrating = shouldCelebrate;
        sprite.mat.map = shouldCelebrate ? sprite.celebTex : sprite.idleTex;
        sprite.mat.needsUpdate = true;
      }
    }

    for (const cloud of this._clouds) {
      cloud.mesh.position.x = cloud.basePosition.x + Math.sin(this._time * 0.18 + cloud.phase) * 0.8;
      cloud.mesh.position.y = cloud.basePosition.y + Math.sin(this._time * 0.22 + cloud.phase) * 0.08;
      if (camera) cloud.mesh.lookAt(camera.position);
    }

    for (const tuft of this._tufts) {
      tuft.mesh.position.y = tuft.baseY;
      tuft.mesh.rotation.z = Math.sin(this._time * 1.4 + tuft.phase) * 0.04;
    }

    const sponsorIdx = Math.floor(this._time / 10);
    for (let i = 0; i < this._sponsorMeshes.length; i++) {
      const texIdx = (sponsorIdx + i) % this._sponsorTextures.length;
      const mesh = this._sponsorMeshes[i]!;
      (mesh.material as THREE.MeshBasicMaterial).map = this._sponsorTextures[texIdx]!;
      (mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
  }

  /** First delivery run-up of an over — sweep spotlights through the crowd. */
  onSessionPlayStart(): void {
    this._activities.triggerSpotlightSweep();
  }

  /**
   * Edge-triggered from Renderer when `round.outcome` resolves.
   * Drives contextual LED copy + crowd / confetti reactions.
   */
  onDeliverySpectacle(kind: 'four' | 'six' | 'wicket' | 'miss'): void {
    this._sponsorRibbon.triggerEvent(kind);
    if (kind === 'six') {
      this._activities.triggerConfetti();
      this._crowdWaveBoost = 1.5;
      this._reactionTimer = 2.2;
    } else if (kind === 'four') {
      this._crowdWaveBoost = 0.85;
      this._reactionTimer = 1.2;
    } else if (kind === 'wicket' || kind === 'miss') {
      this._activities.setExcitement(0.12);
      this._reactionTimer = 0;
      for (const sprite of this._crowdSprites) {
        if (sprite.celebrating) {
          sprite.celebrating = false;
          sprite.mat.map = sprite.idleTex;
          sprite.mat.needsUpdate = true;
        }
      }
    }
  }

  /** Continuous excitement for phone-flash / camera flashes (0–1). */
  setLivingExcitement(level: number): void {
    this._activities.setExcitement(level);
  }

  dispose(): void {
    this._arenaLivingRoot.removeFromParent();
    this._sponsorRibbon.dispose();
    this._activities.dispose();
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
    });
    this._scoreboardTex.dispose();
    for (const tex of this._sponsorTextures) tex.dispose();
  }

  private buildOutfield(): void {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ map: makeOutfieldTexture(), roughness: 0.88, metalness: 0.0 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0, MID_Z);
    this.root.add(mesh);
  }

  private buildPitch(): void {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, PITCH_LEN),
      new THREE.MeshStandardMaterial({ map: makePitchTexture(), roughness: 0.78, metalness: 0.0 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.003, MID_Z);
    mesh.scale.x = 0.9;
    mesh.scale.z = 0.85;
    this.root.add(mesh);

    // Subtle edge glow strips — cinematic separation from field
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0xfff5d0,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });
    for (const xSign of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.10, PITCH_LEN * 0.85), edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(xSign * 1.33, 0.005, MID_Z);
      this.root.add(edge);
    }
  }

  private buildCreases(): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const poppingOff = 1.22;
    const creaseW = 2.64;
    const returnLen = 1.22;

    for (const z of [WORLD.STUMPS_NEAR_Z - poppingOff, WORLD.STUMPS_FAR_Z + poppingOff]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(creaseW, 0.12), mat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.005, z);
      this.root.add(line);
    }

    for (const sign of [-1, 1]) {
      for (const baseZ of [WORLD.STUMPS_NEAR_Z - poppingOff, WORLD.STUMPS_FAR_Z + poppingOff]) {
        const dir = baseZ < 0 ? 1 : -1;
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, returnLen), mat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(sign * (creaseW / 2), 0.005, baseZ + (dir * returnLen) / 2);
        this.root.add(line);
      }
    }
  }

  private buildStumps(centreZ: number): void {
    const stumpMat = new THREE.MeshBasicMaterial({ color: 0xb87b48 });
    const bailMat = new THREE.MeshBasicMaterial({ color: 0xf8d354 });
    const h = 0.71;
    const r = 0.018;

    for (const x of [-0.115, 0, 0.115]) {
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), stumpMat);
      stump.position.set(x, h / 2, centreZ);
      this.root.add(stump);
    }

    for (const x of [-0.057, 0.057]) {
      const bail = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.136, 6), bailMat);
      bail.rotation.z = Math.PI / 2;
      bail.position.set(x, h + 0.012, centreZ);
      this.root.add(bail);
    }
  }

  private buildBoundaryRope(): void {
    const rope = new THREE.Mesh(
      new THREE.TorusGeometry(BOUNDARY_R, 0.05, 6, 128),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    rope.rotation.x = Math.PI / 2;
    rope.position.set(0, 0.03, MID_Z);
    this.root.add(rope);

    // Gold accent ring just inside the rope — softer in daylight
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(BOUNDARY_R - 0.45, BOUNDARY_R - 0.05, 96),
      new THREE.MeshBasicMaterial({
        color: 0xffb800,
        transparent: true,
        opacity: 0.20,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, 0.015, MID_Z);
    this.root.add(glow);
  }

  private buildWheatFence(assets: DoodleAssets): void {
    const fenceR = BOUNDARY_R + 1.2;
    const sections = 40;

    for (let i = 0; i < sections; i++) {
      const angle = (i / sections) * Math.PI * 2;
      if (Math.sin(angle) > SKIP_SIN_THRESHOLD) continue;

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 2.4),
        new THREE.MeshBasicMaterial({
          map: assets.wheat,
          transparent: true,
          alphaTest: 0.05,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      mesh.position.set(Math.cos(angle) * fenceR, 1.2, MID_Z + Math.sin(angle) * fenceR);
      mesh.lookAt(0, 1.2, MID_Z);
      this.root.add(mesh);
    }
  }

  private buildStands(): void {
    const sectionAngle = (Math.PI * 2) / STAND_SECTIONS;
    const backMat = new THREE.MeshStandardMaterial({ color: 0xb4c8d8, roughness: 0.82, metalness: 0.0 });
    // Controlled palette: deep blue + cyan + gold — no rainbow chaos
    const seatMats = [0x0088cc, 0x00aaee, 0xf0a820, 0x0066aa]
      .map((color) => new THREE.MeshStandardMaterial({
        color,
        roughness: 0.62,
        metalness: 0.0,
        emissive: color,
        emissiveIntensity: 0.14,
      }));
    const look = new THREE.Vector3();

    for (let s = 0; s < STAND_SECTIONS; s++) {
      const angle = (s / STAND_SECTIONS) * Math.PI * 2;
      if (Math.sin(angle) > SKIP_SIN_THRESHOLD) continue;

      const colorMat = seatMats[s % seatMats.length]!;

      for (let tier = 0; tier < TIERS; tier++) {
        const r = INNER_R + tier * TIER_STEP_R;
        const px = Math.cos(angle) * r;
        const pz = MID_Z + Math.sin(angle) * r;
        const py = TIER_STEP_H + tier * TIER_STEP_H;
        const chordW = 2 * r * Math.tan(sectionAngle / 2) * 1.03;

        const back = new THREE.Mesh(
          new THREE.BoxGeometry(chordW, TIER_STEP_H, TIER_STEP_R),
          backMat,
        );
        back.position.set(px, py - TIER_STEP_H / 2, pz);
        look.set(0, back.position.y, MID_Z);
        back.lookAt(look);
        this.root.add(back);

        const seat = new THREE.Mesh(
          new THREE.BoxGeometry(chordW, 0.07, TIER_STEP_R * 0.72),
          colorMat,
        );
        seat.position.set(px, py + 0.035, pz);
        look.set(0, seat.position.y, MID_Z);
        seat.lookAt(look);
        this.root.add(seat);
      }

      const wallR = INNER_R + TIERS * TIER_STEP_R + 0.4;
      const wallH = TIERS * TIER_STEP_H + 2.5;
      const chordW = 2 * wallR * Math.tan(sectionAngle / 2) * 1.03;
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(chordW, wallH, 0.5),
        backMat,
      );
      wall.position.set(Math.cos(angle) * wallR, wallH / 2, MID_Z + Math.sin(angle) * wallR);
      look.set(0, wall.position.y, MID_Z);
      wall.lookAt(look);
      this.root.add(wall);
    }
  }

  private buildCrowd(assets: DoodleAssets): void {
    const sectionArc = (Math.PI * 2) / STAND_SECTIONS;
    const rng = (seed: number) =>
      ((seed * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;

    const addSprite = (
      angle: number, px: number, py: number, pz: number,
      scale: number, seed: number, geomW: number, geomH: number,
    ) => {
      const texIdx = (seed) % assets.audience.length;
      const idleTex = assets.audience[texIdx]!;
      const celebTex = assets.audienceCelebrate[texIdx]!;
      const mat = new THREE.MeshBasicMaterial({
        map: idleTex,
        transparent: true,
        alphaTest: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
        opacity: 0.88,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(geomW, geomH), mat);
      mesh.position.set(px, py, pz);
      mesh.rotation.y = (rng(seed + 13) - 0.5) * 0.4;
      mesh.scale.setScalar(scale);
      this._crowd.add(mesh);
      this._crowdSprites.push({
        mesh, mat, idleTex, celebTex, celebrating: false,
        basePosition: mesh.position.clone(),
        scale,
        phase: rng(seed + 3) * Math.PI * 2,
        angle,
      });
    };

    // Main tiers (2 rings)
    for (let s = 0; s < STAND_SECTIONS; s++) {
      const baseAngle = (s / STAND_SECTIONS) * Math.PI * 2;
      if (Math.sin(baseAngle) > SKIP_SIN_THRESHOLD) continue;

      for (let tier = 0; tier < TIERS; tier++) {
        const r = INNER_R + tier * TIER_STEP_R + 0.7;
        const py = TIER_STEP_H + tier * TIER_STEP_H + 0.55;

        for (let p = 0; p < PEOPLE_PER_TIER; p++) {
          const seed = s * 100 + tier * 10 + p;
          const frac = (p + 0.5) / PEOPLE_PER_TIER;
          const angle = baseAngle + (frac - 0.5) * sectionArc + (rng(seed) - 0.5) * 0.06;
          const px = Math.cos(angle) * r;
          const pz = MID_Z + Math.sin(angle) * r;
          const scale = 0.72 + rng(seed + 1) * 0.24;
          addSprite(angle, px, py, pz, scale, seed, 0.50, 0.88);
        }
      }
    }

    // Upper deck (tier 2) — smaller, further back, 6 per section
    for (let s = 0; s < STAND_SECTIONS; s++) {
      const baseAngle = (s / STAND_SECTIONS) * Math.PI * 2;
      if (Math.sin(baseAngle) > SKIP_SIN_THRESHOLD) continue;

      const r = INNER_R + 2 * TIER_STEP_R + 0.5;
      const py = TIER_STEP_H + 2 * TIER_STEP_H + 0.55;

      for (let p = 0; p < 6; p++) {
        const seed = s * 100 + 20 + p;
        const frac = (p + 0.5) / 6;
        const angle = baseAngle + (frac - 0.5) * sectionArc + (rng(seed) - 0.5) * 0.05;
        const px = Math.cos(angle) * r;
        const pz = MID_Z + Math.sin(angle) * r;
        const scale = (0.60 + rng(seed + 1) * 0.18) * 0.75;
        addSprite(angle, px, py, pz, scale, seed, 0.42, 0.72);
      }
    }
  }


  private buildForegroundTufts(): void {
    const tuftMat = new THREE.MeshBasicMaterial({ color: 0xf0d24d });
    const positions = [
      [-9.5, 0.9, -16.2],
      [-6.8, 0.95, -17.4],
      [-3.2, 0.85, -18.1],
      [2.9, 0.9, -18.3],
      [6.1, 1.0, -17.6],
      [9.2, 0.86, -16.5],
    ] as const;

    for (let i = 0; i < positions.length; i++) {
      const [x, y, z] = positions[i]!;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.9), tuftMat);
      mesh.position.set(x, y, z);
      this.root.add(mesh);
      this._tufts.push({ mesh, baseY: y, phase: i * 0.9 });
    }
  }

  private buildFloodlightTowers(): void {
    // Four corner towers — 2 behind bowler end, 2 near camera side
    const towers: [number, number][] = [
      [ 22, MID_Z - 22],
      [-22, MID_Z - 22],
      [ 20, MID_Z + 18],
      [-20, MID_Z + 18],
    ];

    const poleMat  = new THREE.MeshStandardMaterial({ color: 0xa6bac8, roughness: 0.48, metalness: 0.35 });
    const headGlow = new THREE.MeshBasicMaterial({ color: 0xfffbe8 });
    const ringMat  = new THREE.MeshBasicMaterial({ color: 0xe2e2c8 });
    const haloMat  = new THREE.MeshBasicMaterial({
      color: 0xfff5b0,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });

    for (const [tx, tz] of towers) {
      // Vertical shaft
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.20, 24, 8), poleMat);
      pole.position.set(tx, 12, tz);
      this.root.add(pole);

      // Horizontal arm at crown
      const arm = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.18, 0.18), poleMat);
      arm.position.set(tx, 24.2, tz);
      this.root.add(arm);

      // 6 lamp heads along the arm
      const lampCount = 6;
      for (let li = 0; li < lampCount; li++) {
        const lx = tx + (li / (lampCount - 1) - 0.5) * 4.4;
        const ly = 24.2;

        // Bright circle head
        const head = new THREE.Mesh(new THREE.CircleGeometry(0.38, 10), headGlow);
        head.position.set(lx, ly, tz);
        head.lookAt(0, 3, MID_Z);
        this.root.add(head);

        // Outer ring
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.40, 0.52, 10), ringMat);
        ring.position.set(lx, ly, tz);
        ring.lookAt(0, 3, MID_Z);
        this.root.add(ring);

        // Soft glow halo
        const halo = new THREE.Mesh(new THREE.CircleGeometry(0.78, 12), haloMat);
        halo.position.set(lx, ly, tz);
        halo.lookAt(0, 3, MID_Z);
        this.root.add(halo);
      }
    }
  }

  private buildAtmosphericHaze(): void {
    const haze = new THREE.Mesh(
      new THREE.SphereGeometry(22, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0xc8e6ff,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    );
    haze.position.set(0, -2, MID_Z);
    this.root.add(haze);
  }

  private buildStandRailings(): void {
    const railMat = new THREE.MeshStandardMaterial({ color: 0xc8d4d8, roughness: 0.45, metalness: 0.20 });
    const look = new THREE.Vector3();
    const sectionAngle = (Math.PI * 2) / STAND_SECTIONS;

    for (let s = 0; s < STAND_SECTIONS; s++) {
      const angle = (s / STAND_SECTIONS) * Math.PI * 2;
      if (Math.sin(angle) > SKIP_SIN_THRESHOLD) continue;

      for (let tier = 0; tier < TIERS; tier++) {
        const r = INNER_R + tier * TIER_STEP_R;
        const py = (tier + 1) * TIER_STEP_H + 0.72;
        const chordW = 2 * r * Math.tan(sectionAngle / 2) * 1.01;
        const rail = new THREE.Mesh(new THREE.BoxGeometry(chordW, 0.07, 0.07), railMat);
        rail.position.set(Math.cos(angle) * r, py, MID_Z + Math.sin(angle) * r);
        look.set(0, py, MID_Z);
        rail.lookAt(look);
        this.root.add(rail);
      }
    }
  }

  private buildSponsorBoards(): void {
    for (const brand of SPONSORS) this._sponsorTextures.push(makeSponsorTexture(brand));

    const boards = 8;
    const r = BOUNDARY_HOARDING.radius;
    for (let i = 0; i < boards; i++) {
      const angle = (i / boards) * Math.PI * 2;
      if (Math.sin(angle) > SKIP_SIN_THRESHOLD) continue;

      for (let row = 0; row < BOUNDARY_HOARDING.rows.length; row++) {
        const rowCfg = BOUNDARY_HOARDING.rows[row]!;
        const texIdx = (i + row * 5) % this._sponsorTextures.length;

        const boardMat = new THREE.MeshBasicMaterial({
          map: this._sponsorTextures[texIdx]!,
          side: THREE.DoubleSide,
        });
        boardMat.color.setHex(0xffffff);
        boardMat.color.offsetHSL(0, 0, ((i + row) % 5 - 2) * 0.012);

        const board = new THREE.Mesh(
          new THREE.PlaneGeometry(rowCfg.boardW, rowCfg.boardH),
          boardMat,
        );
        const wy = rowCfg.centerY;
        board.position.set(Math.cos(angle) * r, wy, MID_Z + Math.sin(angle) * r);
        board.lookAt(0, wy + BOUNDARY_HOARDING.lookTargetYBias, MID_Z);

        const postMat = new THREE.MeshBasicMaterial({ color: 0x6a553f });
        const postH = rowCfg.postDepth;
        const py = rowCfg.postYOffset;
        const postHalf = rowCfg.boardW * 0.44;
        const postL = new THREE.Mesh(new THREE.BoxGeometry(0.06, postH, 0.06), postMat);
        const postR = new THREE.Mesh(new THREE.BoxGeometry(0.06, postH, 0.06), postMat);
        postL.position.set(-postHalf, py, 0);
        postR.position.set(postHalf, py, 0);
        board.add(postL);
        board.add(postR);

        const shadowDrop = Math.max(0.35, Math.abs(py) - postH * 0.5 + rowCfg.boardH * 0.48);
        const boardShadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.32 + row * 0.06, 20),
          new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: row === 0 ? 0.14 : 0.08,
            depthWrite: false,
          }),
        );
        boardShadow.rotation.x = -Math.PI / 2;
        boardShadow.position.set(0, -shadowDrop, 0.015);
        board.add(boardShadow);

        this._sponsorMeshes.push(board);
        this.root.add(board);
      }
    }
  }

  private buildScoreboard(): void {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(8.4, 4.2, 0.5),
      new THREE.MeshStandardMaterial({
        color: 0x1a2030,
        roughness: 0.35,
        metalness: 0.55,
        emissive: 0xffb800,
        emissiveIntensity: 0.05,
      }),
    );

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(7.8, 3.6),
      new THREE.MeshBasicMaterial({ map: this._scoreboardTex }),
    );
    screen.position.z = 0.31;
    frame.add(screen);

    frame.position.set(0, 9.5, MID_Z - 25);
    frame.lookAt(0, 9.5, MID_Z);
    this.root.add(frame);
  }
}
