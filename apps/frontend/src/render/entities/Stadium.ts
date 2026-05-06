import * as THREE from 'three';
import { WORLD } from '../../engine/constants.js';
import type { DoodleAssets } from '../doodle/DoodleAssets.js';

const MID_Z = (WORLD.STUMPS_FAR_Z + WORLD.STUMPS_NEAR_Z) / 2;
const PITCH_LEN = Math.abs(WORLD.STUMPS_FAR_Z - WORLD.STUMPS_NEAR_Z);
const STAND_SECTIONS = 32;
const INNER_R = 18;
const TIER_STEP_R = 2.4;
const TIER_STEP_H = 1.5;
const TIERS = 2;
const PEOPLE_PER_TIER = 3;
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

  const bands = 12;
  const bandH = size / bands;
  for (let i = 0; i < bands; i++) {
    cx.fillStyle = i % 2 === 0 ? '#a8d86e' : '#98cf5d';
    cx.fillRect(0, i * bandH, size, bandH);
  }

  cx.strokeStyle = 'rgba(255,255,255,0.14)';
  cx.lineWidth = 6;
  for (let i = 1; i < bands; i += 2) {
    cx.beginPath();
    cx.moveTo(0, i * bandH);
    cx.lineTo(size, i * bandH);
    cx.stroke();
  }
  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    cx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.022)';
    cx.fillRect(x, y, 1.6, 1.6);
  }

  const tex = toTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function makePitchTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const cx = cv.getContext('2d')!;

  cx.fillStyle = '#e6c897';
  cx.fillRect(0, 0, w, h);

  cx.strokeStyle = 'rgba(255,255,255,0.14)';
  cx.lineWidth = 4;
  for (let y = 24; y < h; y += 28) {
    cx.beginPath();
    cx.moveTo(18, y);
    cx.lineTo(w - 18, y);
    cx.stroke();
  }

  cx.strokeStyle = 'rgba(145,110,64,0.12)';
  cx.lineWidth = 2;
  cx.strokeRect(8, 8, w - 16, h - 16);
  for (let i = 0; i < 620; i++) {
    const x = 10 + Math.random() * (w - 20);
    const y = 10 + Math.random() * (h - 20);
    cx.fillStyle = i % 2 === 0 ? 'rgba(120,90,50,0.03)' : 'rgba(255,255,255,0.02)';
    cx.fillRect(x, y, 1.4, 1.4);
  }

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
  ballIdx: number,
  totalBalls: number,
  multiplier: number,
): void {
  const w = 512;
  const h = 256;
  cv.width = w;
  cv.height = h;
  const cx = cv.getContext('2d')!;

  cx.fillStyle = '#74c9f6';
  cx.fillRect(0, 0, w, h);

  cx.fillStyle = '#ffffff';
  cx.fillRect(18, 18, w - 36, h - 36);
  cx.strokeStyle = '#4e90c9';
  cx.lineWidth = 8;
  cx.strokeRect(18, 18, w - 36, h - 36);

  cx.fillStyle = '#4e90c9';
  cx.font = 'bold 28px Arial, sans-serif';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText('CRICKET CRASH', w / 2, 50);

  cx.fillStyle = '#67883f';
  cx.font = '20px Arial, sans-serif';
  cx.fillText(`BALL ${ballIdx + 1} OF ${totalBalls}`, w / 2, 92);

  const pipR = 14;
  const pipGap = 36;
  const startX = w / 2 - ((totalBalls - 1) * pipGap) / 2;
  for (let i = 0; i < totalBalls; i++) {
    cx.beginPath();
    cx.arc(startX + i * pipGap, 134, pipR, 0, Math.PI * 2);
    cx.fillStyle = i < ballIdx ? '#94d95f' : i === ballIdx ? '#ffd84e' : '#d7eef9';
    cx.fill();
    cx.strokeStyle = '#4e90c9';
    cx.lineWidth = 3;
    cx.stroke();
  }

  cx.fillStyle = multiplier >= 2 ? '#4aa864' : '#f0af2c';
  cx.font = `bold ${multiplier >= 10 ? 44 : 54}px Arial, sans-serif`;
  cx.fillText(`x${multiplier.toFixed(2)}`, w / 2, 196);
}

type CrowdSprite = {
  mesh: THREE.Mesh;
  basePosition: THREE.Vector3;
  scale: number;
  phase: number;
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
    this.buildCrowd(assets);
    this.buildSun();
    this.buildClouds(assets);
    this.buildForegroundTufts();

    this.root.add(this._crowd);

    this._scoreboardCanvas = document.createElement('canvas');
    makeScoreboardTexture(this._scoreboardCanvas, 0, 6, 1.0);
    this._scoreboardTex = toTexture(this._scoreboardCanvas);
    this.buildScoreboard();
  }

  updateScoreboard(ballIdx: number, totalBalls: number, multiplier: number): void {
    makeScoreboardTexture(this._scoreboardCanvas, ballIdx, totalBalls, multiplier);
    this._scoreboardTex.needsUpdate = true;
  }

  updateAnimations(dt: number, camera?: THREE.Camera): void {
    this._time += dt;

    for (const sprite of this._crowdSprites) {
      const sway = Math.sin(this._time * 1.5 + sprite.phase) * 0.035;
      const bob = Math.sin(this._time * 1.8 + sprite.phase) * 0.012;
      sprite.mesh.position.set(
        sprite.basePosition.x + sway,
        sprite.basePosition.y + bob,
        sprite.basePosition.z + Math.cos(this._time * 1.2 + sprite.phase) * 0.02,
      );
      sprite.mesh.scale.setScalar(sprite.scale);
      if (camera) sprite.mesh.lookAt(camera.position);
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

  dispose(): void {
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
      new THREE.MeshBasicMaterial({ map: makeOutfieldTexture() }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0, MID_Z);
    this.root.add(mesh);
  }

  private buildPitch(): void {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, PITCH_LEN),
      new THREE.MeshBasicMaterial({ map: makePitchTexture() }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.003, MID_Z);
    mesh.scale.x = 0.9;
    mesh.scale.z = 0.85;
    this.root.add(mesh);
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
    const backMat = new THREE.MeshBasicMaterial({ color: 0xe7eef0 });
    const seatMats = [0x74c9f6, 0xffcf57, 0x94d95f, 0xf5a0b5, 0xa8d8c0]
      .map((color) => new THREE.MeshBasicMaterial({ color }));
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
          const hue = 0.08 + rng(seed + 7) * 0.72;
          const sat = 0.45 + rng(seed + 9) * 0.25;
          const lit = 0.45 + rng(seed + 11) * 0.2;
          const mat = new THREE.MeshBasicMaterial({
            map: assets.audience[(seed + p + tier) % assets.audience.length],
            transparent: true,
            alphaTest: 0.05,
            side: THREE.DoubleSide,
            depthWrite: false,
            opacity: 0.74,
          });
          mat.color = new THREE.Color().setHSL(hue, sat, lit);
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), mat);
          mesh.position.set(px, py, pz);
          mesh.rotation.y = (rng(seed + 13) - 0.5) * 0.4;
          mesh.scale.setScalar(scale);
          this._crowd.add(mesh);
          this._crowdSprites.push({
            mesh,
            basePosition: mesh.position.clone(),
            scale,
            phase: rng(seed + 3) * Math.PI * 2,
          });
        }
      }
    }
  }

  private buildSun(): void {
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 24),
      new THREE.MeshBasicMaterial({ color: 0xffdc62 }),
    );
    sun.position.set(12.5, 15.5, MID_Z - 28);
    this.root.add(sun);

    const glow = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 2.05, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffef9f,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    glow.position.copy(sun.position);
    this.root.add(glow);
  }

  private buildClouds(assets: DoodleAssets): void {
    const positions: [number, number, number][] = [
      [-20, 22, -30],
      [15, 25, -35],
      [-8, 20, -25],
      [25, 18, -20],
      [-30, 24, -28],
    ];

    for (const [x, y, z] of positions) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(12, 6),
        new THREE.MeshBasicMaterial({
          map: assets.cloud,
          transparent: true,
          alphaTest: 0.01,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      mesh.position.set(x, y, z);
      this.root.add(mesh);
      this._clouds.push({
        mesh,
        basePosition: mesh.position.clone(),
        phase: (x + y + z) * 0.1,
      });
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

  private buildSponsorBoards(): void {
    for (const brand of SPONSORS) this._sponsorTextures.push(makeSponsorTexture(brand));

    const boards = 16;
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
      new THREE.MeshBasicMaterial({ color: 0x5eaee6 }),
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
