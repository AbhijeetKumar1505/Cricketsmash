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
  { name: 'BOKA COLA',       tagline: 'Taste the Crash',                     bg: '#8b0000', fg: '#ffffff', accent: '#ff3333' },
  { name: 'BURPSI',          tagline: 'The Next Gulp',                       bg: '#00308f', fg: '#ffffff', accent: '#3399ff' },
  { name: 'DEAD BULL',       tagline: 'Gives You Wings, Takes Them Back',    bg: '#1a1a3e', fg: '#ffd700', accent: '#4444ff' },
  { name: 'LAZY\'S',         tagline: 'Bet You Can\'t Hit Just One',         bg: '#b8860b', fg: '#ffffff', accent: '#ffcc00' },
  { name: 'DORIDON\'TS',     tagline: 'For the Bold (and Broke)',            bg: '#cc3300', fg: '#ffffff', accent: '#ff6622' },
  { name: 'NIKO',            tagline: 'Don\'t Do It',                        bg: '#1a1a1a', fg: '#ffffff', accent: '#ff6600' },
  { name: 'BADIDAS',         tagline: 'Impossible is Guaranteed',            bg: '#111111', fg: '#ffffff', accent: '#aaaaaa' },
  { name: 'LOOMA',           tagline: 'Forever Slower',                      bg: '#1a1a1a', fg: '#d4af37', accent: '#ffd700' },
  { name: 'NO BALANCE',      tagline: 'Endorsed by Nobody',                  bg: '#c0392b', fg: '#ffffff', accent: '#3498db' },
  { name: 'WEAKBOK',         tagline: 'I Am Not Fit',                        bg: '#1a3c6e', fg: '#ff4444', accent: '#ff6666' },
  { name: 'FAILRARI',        tagline: 'Built for Speed, Stuck in Park',      bg: '#cc0000', fg: '#ffd700', accent: '#ff4444' },
  { name: 'LUMBERING-HINI',  tagline: 'Slow and Expensive',                  bg: '#2a2a0a', fg: '#ffd700', accent: '#ccaa00' },
  { name: 'POORSCHE',        tagline: 'There Is No Refund',                  bg: '#1a1a1a', fg: '#d4af37', accent: '#c0a030' },
  { name: 'BRW',             tagline: 'Barely Running Well',                 bg: '#0a2a4a', fg: '#ffffff', accent: '#4488cc' },
  { name: 'BLASTERCARD',     tagline: 'Priceless... and Empty',              bg: '#cc4400', fg: '#ffffff', accent: '#ff6622' },
  { name: 'VISA-LESS',       tagline: 'Everywhere You Aren\'t',              bg: '#1a237e', fg: '#ffd700', accent: '#3355cc' },
  { name: 'DAPPLE',          tagline: 'Think Differently About Your Wallet', bg: '#2a2a2a', fg: '#c0c0c0', accent: '#888888' },
  { name: 'SAMESUNG',        tagline: 'Do What You Can\'t Afford',           bg: '#0d47a1', fg: '#ffffff', accent: '#2196f3' },
  { name: 'HEINECANT',       tagline: 'Probably the Worst Beer',             bg: '#004d00', fg: '#ff3333', accent: '#00cc44' },
  { name: 'BUDDWEAKER',      tagline: 'King of Broken Dreams',               bg: '#8b0000', fg: '#ffd700', accent: '#cc3333' },
  { name: 'MONSTER LAZY',    tagline: 'Unleash the Nap',                     bg: '#0a1a0a', fg: '#00ff44', accent: '#00cc33' },
];

// ─── Contextual Event Messages ───────────────────────────────────────────────

interface ContextualAd {
  brand: string;
  message: string;
  color: string;
}

const EVENT_ADS: Record<string, ContextualAd[]> = {
  four: [
    { brand: 'LAZY\'S',     message: 'Crispy Shot! 🔥',           color: '#ffcc00' },
    { brand: 'NIKO',        message: 'They Did It Anyway!',       color: '#ff6600' },
    { brand: 'FAILRARI',    message: 'Actually Moved!',           color: '#ff4444' },
    { brand: 'BURPSI',      message: 'Gulp That Down!',           color: '#3399ff' },
  ],
  six: [
    { brand: 'DEAD BULL',   message: 'He Flew! 🚀',              color: '#ffd700' },
    { brand: 'BOKA COLA',   message: 'TASTE THAT!',              color: '#ff3333' },
    { brand: 'FAILRARI',    message: 'Top Speed Reached!',       color: '#ff4444' },
    { brand: 'MONSTER LAZY', message: 'FULLY AWAKE! ⚡',         color: '#00ff44' },
  ],
  wicket: [
    { brand: 'NIKO',        message: 'You Did It 😭',            color: '#ff6600' },
    { brand: 'NO BALANCE',  message: 'Obviously.',               color: '#ff4444' },
    { brand: 'POORSCHE',    message: 'No Refund Available',      color: '#c0a030' },
    { brand: 'BLASTERCARD', message: 'That Was Priceless 💀',    color: '#ff6622' },
  ],
  miss: [
    { brand: 'NO BALANCE',  message: 'Obviously.',               color: '#cc4444' },
    { brand: 'WEAKBOK',     message: 'Called It.',                color: '#ff6666' },
    { brand: 'BADIDAS',     message: 'Impossible Indeed.',        color: '#aaaaaa' },
    { brand: 'LOOMA',       message: 'Speed: 0 km/h',            color: '#ffd700' },
  ],
};

// ─── Constants ───────────────────────────────────────────────────────────────

const PANEL_COUNT = 16;
const RIBBON_RADIUS = 42;
const RIBBON_Y = 4.0;
const RIBBON_H = 2.0;
const TEX_W = 512;
const TEX_H = 96;
const ROTATION_INTERVAL = 4.0; // seconds between brand rotations
const EVENT_FLASH_DURATION = 2.5;

// ─── Canvas Drawing Helpers ──────────────────────────────────────────────────

function drawBrandPanel(ctx: CanvasRenderingContext2D, brand: SponsorBrand, pulse: number) {
  const W = TEX_W, H = TEX_H;
  ctx.clearRect(0, 0, W, H);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, 0);
  bg.addColorStop(0, brand.bg + 'cc');
  bg.addColorStop(0.3, brand.bg);
  bg.addColorStop(0.7, brand.bg);
  bg.addColorStop(1, brand.bg + 'cc');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Neon border strips
  const borderAlpha = Math.floor(80 + pulse * 120).toString(16).padStart(2, '0');
  ctx.fillStyle = brand.accent + borderAlpha;
  ctx.fillRect(0, 0, W, 3);
  ctx.fillRect(0, H - 3, W, 3);
  ctx.fillRect(0, 0, 4, H);
  ctx.fillRect(W - 4, 0, 4, H);

  // Brand name — large, glowing
  ctx.save();
  ctx.shadowBlur = 20 + pulse * 15;
  ctx.shadowColor = brand.accent;
  ctx.fillStyle = brand.fg;
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(brand.name, W / 2, H * 0.38);
  ctx.restore();

  // Tagline — smaller, subtle
  ctx.save();
  ctx.shadowBlur = 8;
  ctx.shadowColor = brand.accent;
  ctx.fillStyle = brand.accent + 'bb';
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(brand.tagline, W / 2, H * 0.72);
  ctx.restore();

  // Subtle scan line effect
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 1);
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
