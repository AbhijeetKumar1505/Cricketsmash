import * as THREE from 'three';

// ─── Parody Brand Definitions ────────────────────────────────────────────────

interface SponsorBrand {
  name: string;
  tagline: string;
  bg: string;      // primary background hex
  fg: string;      // text color hex
  accent: string;  // glow / accent hex
}

const BRANDS: SponsorBrand[] = [
  { name: 'POORSCHE',        tagline: 'There Is No Refund',                  bg: '#1a1a1a', fg: '#d4af37', accent: '#ffd700' },
  { name: 'HEINECANT',       tagline: 'Probably the Worst Beer',             bg: '#004d00', fg: '#ff3333', accent: '#00cc44' },
  { name: 'BADIDAS',         tagline: 'Impossible is Guaranteed',            bg: '#111111', fg: '#ffffff', accent: '#aaaaaa' },
  { name: 'BOKA COLA',       tagline: 'Taste the Crash',                     bg: '#8b0000', fg: '#ffffff', accent: '#ff3333' },
  { name: 'BURPSI',          tagline: 'The Next Gulp',                       bg: '#00308f', fg: '#ffffff', accent: '#3399ff' },
  { name: 'DEAD BULL',       tagline: 'Gives You Wings, Takes Them Back',    bg: '#1a1a3e', fg: '#ffd700', accent: '#4444ff' },
  { name: 'LOOMA',           tagline: 'Forever Slower',                      bg: '#1a1a1a', fg: '#d4af37', accent: '#ffd700' },
  { name: 'SAMESUNG',        tagline: 'Do What You Can\'t Afford',           bg: '#0d47a1', fg: '#ffffff', accent: '#2196f3' },
  { name: 'BLASTERCARD',     tagline: 'Priceless... and Empty',              bg: '#cc4400', fg: '#ffffff', accent: '#ff6622' },
  { name: 'VISA-LESS',       tagline: 'Everywhere You Aren\'t',              bg: '#1a237e', fg: '#ffd700', accent: '#3355cc' },
];

// ─── Contextual Event Messages ───────────────────────────────────────────────

interface ContextualAd {
  brand: string;
  message: string;
  color: string;
}

const EVENT_ADS: Record<string, ContextualAd[]> = {
  four: [
    { brand: 'HEINECANT', message: 'That\'s a Cold Shot! 🍻',      color: '#00cc44' },
    { brand: 'BADIDAS',    message: 'Nothing is Impossible!',     color: '#aaaaaa' },
  ],
  six: [
    { brand: 'POORSCHE',  message: 'TOP SPEED REACHED! 🏎️',       color: '#ffd700' },
    { brand: 'DEAD BULL', message: 'HE FLEW! 🚀',                color: '#4444ff' },
  ],
  wicket: [
    { brand: 'POORSCHE',  message: 'Refund Denied 💀',            color: '#ffd700' },
    { brand: 'VISA-LESS', message: 'Declined Everywhere',         color: '#3355cc' },
  ],
  miss: [
    { brand: 'BADIDAS',   message: 'Impossible Indeed.',          color: '#aaaaaa' },
  ],
};

// ─── Constants ───────────────────────────────────────────────────────────────

const PANEL_COUNT = 14; 
const RIBBON_RADIUS = 43;
const RIBBON_Y = 4.8;
const RIBBON_H = 4.2; 
const TEX_W = 1024; 
const TEX_H = 256;
const ROTATION_INTERVAL = 4.5;
const EVENT_FLASH_DURATION = 3.0;

// ─── Canvas Drawing Helpers ──────────────────────────────────────────────────

function drawBrandPanel(ctx: CanvasRenderingContext2D, brand: SponsorBrand, pulse: number) {
  const W = TEX_W, H = TEX_H;
  ctx.clearRect(0, 0, W, H);

  // Deep dark premium background
  ctx.fillStyle = '#080a12';
  ctx.fillRect(0, 0, W, H);

  // Background brand-glow gradient
  const bg = ctx.createLinearGradient(0, 0, W, 0);
  bg.addColorStop(0,   brand.bg + '33');
  bg.addColorStop(0.5, brand.bg + '55');
  bg.addColorStop(1,   brand.bg + '33');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // High-fidelity neon rails
  const accentPulse = 0.8 + Math.sin(pulse * 4) * 0.2;
  ctx.shadowBlur = 20 * accentPulse;
  ctx.shadowColor = brand.accent;
  ctx.fillStyle = brand.accent;
  ctx.fillRect(0, 0, W, 8);
  ctx.fillRect(0, H - 8, W, 8);

  // Brand name — Massive esports-broadcast style
  ctx.save();
  ctx.shadowBlur = 15;
  ctx.shadowColor = brand.accent;
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 110px "Orbitron", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '8px';
  ctx.fillText(brand.name, W / 2, H * 0.46);
  ctx.restore();

  // Tagline — Sharp digital aesthetic
  ctx.save();
  ctx.fillStyle = brand.accent;
  ctx.font = '700 28px "Orbitron", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '12px';
  ctx.globalAlpha = 0.8;
  ctx.fillText(brand.tagline, W / 2, H * 0.84);
  ctx.restore();

  // Scanline overlay
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 2);
  }
}

function drawEventFlash(ctx: CanvasRenderingContext2D, ad: ContextualAd, flash: number) {
  const W = TEX_W, H = TEX_H;
  ctx.clearRect(0, 0, W, H);

  // Intense dark background
  ctx.fillStyle = 'rgba(0,0,0,0.95)';
  ctx.fillRect(0, 0, W, H);

  // Pulsing accent border
  const intensity = 0.6 + Math.sin(flash * 8) * 0.4;
  const alpha = Math.floor(intensity * 255).toString(16).padStart(2, '0');
  ctx.fillStyle = ad.color + alpha;
  ctx.fillRect(0, 0, W, 4);
  ctx.fillRect(0, H - 4, W, 4);
  ctx.fillRect(0, 0, 5, H);
  ctx.fillRect(W - 5, 0, 5, H);

  // Inner glow
  const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.45);
  glow.addColorStop(0, ad.color + '22');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Brand name
  ctx.save();
  ctx.shadowBlur = 25;
  ctx.shadowColor = ad.color;
  ctx.fillStyle = ad.color;
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ad.brand, W / 2, H * 0.32);
  ctx.restore();

  // Event message
  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ad.message, W / 2, H * 0.70);
  ctx.restore();
}

// ─── System Class ────────────────────────────────────────────────────────────

export class SponsorBannerSystem {
  readonly group: THREE.Group;
  private meshes: THREE.Mesh[] = [];
  private textures: THREE.CanvasTexture[] = [];
  private canvases: HTMLCanvasElement[] = [];
  private contexts: CanvasRenderingContext2D[] = [];

  // Rotation state
  private brandOffset = 0;       // current first-brand index in rotation
  private rotationTimer = 0;     // time since last rotation
  private animTime = 0;

  // Event flash state
  private eventActive = false;
  private eventTimer = 0;
  private eventAd: ContextualAd | null = null;

  constructor() {
    this.group = new THREE.Group();

    for (let i = 0; i < PANEL_COUNT; i++) {
      const angle = (i / PANEL_COUNT) * Math.PI * 2;

      const canvas = document.createElement('canvas');
      canvas.width = TEX_W;
      canvas.height = TEX_H;
      const ctx = canvas.getContext('2d')!;

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.colorSpace = THREE.SRGBColorSpace;

      const panelArc = (Math.PI * 2) / PANEL_COUNT;
      const panelWidth = 2 * RIBBON_RADIUS * Math.sin(panelArc / 2);

      const geo = new THREE.PlaneGeometry(panelWidth * 0.96, RIBBON_H);
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        Math.sin(angle) * RIBBON_RADIUS,
        RIBBON_Y,
        Math.cos(angle) * RIBBON_RADIUS,
      );
      // Face inward (toward pitch center)
      mesh.rotation.y = angle + Math.PI;

      this.group.add(mesh);
      this.meshes.push(mesh);
      this.textures.push(texture);
      this.canvases.push(canvas);
      this.contexts.push(ctx);
    }

    // Draw initial brand panels
    this.drawAllPanels(0);
  }

  // ── Public API ──

  /** Call when a game event occurs — flashes contextual ads */
  triggerEvent(eventType: 'four' | 'six' | 'wicket' | 'miss') {
    const ads = EVENT_ADS[eventType];
    if (!ads || ads.length === 0) return;
    this.eventAd = ads[Math.floor(Math.random() * ads.length)]!;
    this.eventActive = true;
    this.eventTimer = 0;
  }

  update(dt: number, phase: string) {
    this.animTime += dt;

    // Handle event flash overlay
    if (this.eventActive) {
      this.eventTimer += dt;
      if (this.eventTimer >= EVENT_FLASH_DURATION) {
        this.eventActive = false;
        this.eventAd = null;
        this.drawAllPanels(0); // Restore normal brands
      } else {
        // Draw event flash on all panels
        for (let i = 0; i < PANEL_COUNT; i++) {
          drawEventFlash(this.contexts[i]!, this.eventAd!, this.eventTimer);
          this.textures[i]!.needsUpdate = true;
        }
      }
    } else {
      // Normal brand rotation
      this.rotationTimer += dt;
      if (this.rotationTimer >= ROTATION_INTERVAL) {
        this.rotationTimer = 0;
        this.brandOffset = (this.brandOffset + 1) % BRANDS.length;
        this.drawAllPanels(0);
      }
    }

    // Opacity / glow pulse based on phase
    const isActive = phase === 'hit' || phase === 'bowl';
    const pulse = isActive
      ? 0.85 + Math.sin(this.animTime * 3.5) * 0.15
      : 0.55 + Math.sin(this.animTime * 1.2) * 0.1;

    for (const mesh of this.meshes) {
      (mesh.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
  }

  dispose() {
    for (const t of this.textures) t.dispose();
    for (const m of this.meshes) {
      (m.geometry as THREE.BufferGeometry).dispose();
      (m.material as THREE.Material).dispose();
    }
  }

  // ── Internals ──

  private drawAllPanels(pulse: number) {
    for (let i = 0; i < PANEL_COUNT; i++) {
      const brandIdx = (this.brandOffset + i) % BRANDS.length;
      const brand = BRANDS[brandIdx]!;
      drawBrandPanel(this.contexts[i]!, brand, pulse);
      this.textures[i]!.needsUpdate = true;
    }
  }
}
