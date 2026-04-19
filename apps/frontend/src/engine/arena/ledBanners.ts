import * as THREE from 'three';

interface BannerDef {
  pos: [number, number, number];
  rotY: number;
}

// Four panels facing inward around the boundary
const DEFS: BannerDef[] = [
  { pos: [  0, 8.5, -52], rotY: Math.PI },        // Behind batsman end
  { pos: [  0, 8.5,  52], rotY: 0 },              // Behind bowler end
  { pos: [ 52, 8.5,   0], rotY: -Math.PI / 2 },   // East
  { pos: [-52, 8.5,   0], rotY:  Math.PI / 2 },   // West
];

const W = 512;
const H = 64;

export class LedBannerSystem {
  group: THREE.Group;
  private meshes: THREE.Mesh[] = [];
  private textures: THREE.CanvasTexture[] = [];
  private canvases: HTMLCanvasElement[] = [];
  private currentMult = -1;
  private animTime = 0;

  constructor() {
    this.group = new THREE.Group();

    for (const def of DEFS) {
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;

      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const geo = new THREE.PlaneGeometry(18, 2.0);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...def.pos);
      mesh.rotation.y = def.rotY;

      this.group.add(mesh);
      this.meshes.push(mesh);
      this.textures.push(texture);
      this.canvases.push(canvas);
    }

    this.drawIdle();
  }

  private drawIdle() {
    for (const canvas of this.canvases) {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,5,18,0.9)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(99,102,241,0.5)';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CRICKET  CRASH', W / 2, H / 2);
    }
    for (const t of this.textures) t.needsUpdate = true;
  }

  showMultiplier(mult: number) {
    // Only redraw when value changes meaningfully
    if (Math.abs(mult - this.currentMult) < 0.04) return;
    this.currentMult = mult;

    const color =
      mult >= 10 ? '#ff00ff' :
      mult >= 5  ? '#00ffff' :
      mult >= 2  ? '#00ff88' : '#818cf8';

    const label = `${mult.toFixed(2)}×`;

    for (const canvas of this.canvases) {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);

      // Panel background
      const bg = ctx.createLinearGradient(0, 0, W, 0);
      bg.addColorStop(0,   'rgba(0,0,0,0.95)');
      bg.addColorStop(0.5, 'rgba(5,10,25,0.98)');
      bg.addColorStop(1,   'rgba(0,0,0,0.95)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Decorative side pips
      ctx.fillStyle = `${color}55`;
      ctx.fillRect(0, 0, 6, H);
      ctx.fillRect(W - 6, 0, 6, H);

      // Side labels
      ctx.shadowBlur = 6;
      ctx.shadowColor = color;
      ctx.fillStyle = `${color}80`;
      ctx.font = 'bold 11px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText('LIVE', 14, H / 2);
      ctx.textAlign = 'right';
      ctx.fillText('MULT', W - 14, H / 2);

      // Multiplier text — large and glowing
      ctx.shadowBlur = 28;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.font = 'bold 38px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, W / 2, H / 2);
    }

    for (const t of this.textures) t.needsUpdate = true;
  }

  showMessage(text: string, color = '#ffffff') {
    this.currentMult = -1; // Force redraw on next multiplier call
    for (const canvas of this.canvases) {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.92)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 18;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.font = 'bold 30px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, W / 2, H / 2);
    }
    for (const t of this.textures) t.needsUpdate = true;
  }

  update(dt: number, phase: string) {
    this.animTime += dt;

    // Visibility and pulse
    const isActive = phase === 'hit' || phase === 'bowl';
    const pulse = isActive
      ? 0.72 + Math.sin(this.animTime * 2.8) * 0.13
      : 0.35;

    for (const m of this.meshes) {
      (m.material as THREE.MeshBasicMaterial).opacity = pulse;
    }

    // When not in active play, revert to idle branding
    if (!isActive && this.currentMult > 0) {
      this.currentMult = -1;
      this.drawIdle();
    }
  }

  dispose() {
    for (const t of this.textures) t.dispose();
    for (const geo of this.meshes) (geo.geometry as THREE.BufferGeometry).dispose();
  }
}
