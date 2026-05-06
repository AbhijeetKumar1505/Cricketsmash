import * as THREE from 'three';

// ── DoodleAssets — Production-quality Google Doodle characters ─────────────────
// All textures generated ONCE at init. Never per-frame.
// Style rules: thick outlines, huge eyes, 2-3 color palette, clear silhouette.

const W = 256, H = 384;   // 2× bigger canvas for crisp characters
const FW = 160, FH = 160; // fielder canvas
const BW = 64, BH = 64;   // ball/shadow canvas
const OL = 3.5;           // global outline width

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d')!;
  cx.lineCap = 'round';
  cx.lineJoin = 'round';
  return [cv, cx];
}

function toTex(cv: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.premultiplyAlpha = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

/** Outlined filled shape helper */
function fillStroke(cx: CanvasRenderingContext2D, fill: string, stroke: string, lw = OL) {
  cx.fillStyle = fill; cx.fill();
  cx.strokeStyle = stroke; cx.lineWidth = lw; cx.stroke();
}

/** Big expressive eye — THE dominant feature */
function eye(cx: CanvasRenderingContext2D, x: number, y: number, r: number, lx = 0, ly = 0) {
  // White sclera
  cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2);
  fillStroke(cx, '#fff', '#222', r * 0.18);
  // Large pupil
  cx.fillStyle = '#111';
  cx.beginPath(); cx.arc(x + lx * r * 0.22, y + ly * r * 0.18, r * 0.52, 0, Math.PI * 2); cx.fill();
  // Highlight spark
  cx.fillStyle = '#fff';
  cx.beginPath(); cx.arc(x - r * 0.2 + lx * r * 0.08, y - r * 0.25, r * 0.22, 0, Math.PI * 2); cx.fill();
}

// ── Batsman — Green Crocodile ─────────────────────────────────────────────────

export type BatsmanState = 'idle' | 'swing1' | 'swing2' | 'celebrate' | 'stumped';
export type BowlerState = 'idle' | 'run' | 'bowl' | 'release';

function batsman(state: BatsmanState): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(W, H);
  const mx = W / 2;
  const headY = 115, bodyY = 210, legY = 310;
  const headR = 52;

  // ── Legs ──
  cx.strokeStyle = '#2E7D32'; cx.lineWidth = 10;
  cx.beginPath(); cx.moveTo(mx - 18, bodyY + 50); cx.lineTo(mx - 28, legY); cx.stroke();
  cx.beginPath(); cx.moveTo(mx + 18, bodyY + 50); cx.lineTo(mx + 28, legY); cx.stroke();
  // Feet
  cx.beginPath(); cx.ellipse(mx - 32, legY + 4, 16, 7, -0.15, 0, Math.PI * 2);
  fillStroke(cx, '#2E7D32', '#1B5E20');
  cx.beginPath(); cx.ellipse(mx + 32, legY + 4, 16, 7, 0.15, 0, Math.PI * 2);
  fillStroke(cx, '#2E7D32', '#1B5E20');

  // ── Body ──
  cx.beginPath(); cx.ellipse(mx, bodyY, 36, 52, 0, 0, Math.PI * 2);
  fillStroke(cx, '#4CAF50', '#2E7D32');
  // Belly
  cx.beginPath(); cx.ellipse(mx, bodyY + 8, 24, 34, 0, 0, Math.PI * 2);
  cx.fillStyle = '#A5D6A7'; cx.fill();

  // ── Head (elongated crocodile snout) ──
  cx.beginPath(); cx.ellipse(mx, headY, headR, headR * 0.85, 0, 0, Math.PI * 2);
  fillStroke(cx, '#66BB6A', '#2E7D32', 4);

  // Snout bump
  cx.beginPath(); cx.ellipse(mx, headY + 28, 22, 12, 0, 0, Math.PI * 2);
  fillStroke(cx, '#66BB6A', '#2E7D32', 3);
  // Nostrils
  cx.fillStyle = '#1B5E20';
  cx.beginPath(); cx.arc(mx - 7, headY + 30, 3, 0, Math.PI * 2); cx.fill();
  cx.beginPath(); cx.arc(mx + 7, headY + 30, 3, 0, Math.PI * 2); cx.fill();

  // ── EYES (huge — the dominant feature) ──
  eye(cx, mx - 20, headY - 14, 16, 0, 0.5);
  eye(cx, mx + 20, headY - 14, 16, 0, 0.5);

  // ── Expression ──
  cx.strokeStyle = '#1B5E20'; cx.lineWidth = 3;
  if (state === 'celebrate') {
    cx.beginPath(); cx.arc(mx, headY + 16, 14, 0.15, Math.PI - 0.15); cx.stroke();
  } else if (state === 'stumped') {
    cx.beginPath(); cx.arc(mx, headY + 22, 10, Math.PI + 0.3, -0.3); cx.stroke();
    // X eyes
    cx.lineWidth = 3;
    for (const sx of [-20, 20]) {
      cx.beginPath(); cx.moveTo(mx + sx - 6, headY - 20); cx.lineTo(mx + sx + 6, headY - 8); cx.stroke();
      cx.beginPath(); cx.moveTo(mx + sx + 6, headY - 20); cx.lineTo(mx + sx - 6, headY - 8); cx.stroke();
    }
  } else {
    cx.beginPath(); cx.moveTo(mx - 10, headY + 18); cx.lineTo(mx + 10, headY + 18); cx.stroke();
  }

  // ── Arms + Bat ──
  const batAngle = state === 'idle' ? -0.7 : state === 'swing1' ? 0.3 : state === 'swing2' ? 1.5 : state === 'celebrate' ? -0.3 : -0.5;
  cx.strokeStyle = '#4CAF50'; cx.lineWidth = 9;
  // Front arm
  const ax = mx + 30, ay = bodyY - 20;
  const hx = ax + Math.cos(batAngle) * 45, hy = ay + Math.sin(batAngle) * 45;
  cx.beginPath(); cx.moveTo(mx + 30, bodyY - 15); cx.lineTo(hx, hy); cx.stroke();

  // Bat
  const ba = batAngle - 0.25;
  cx.strokeStyle = '#8D6E63'; cx.lineWidth = 5;
  cx.beginPath(); cx.moveTo(hx, hy); cx.lineTo(hx + Math.cos(ba) * 18, hy + Math.sin(ba) * 18); cx.stroke();
  cx.strokeStyle = '#EFEBE9'; cx.lineWidth = 14;
  cx.beginPath();
  cx.moveTo(hx + Math.cos(ba) * 18, hy + Math.sin(ba) * 18);
  cx.lineTo(hx + Math.cos(ba) * 55, hy + Math.sin(ba) * 55);
  cx.stroke();
  cx.strokeStyle = '#D7CCC8'; cx.lineWidth = 3;
  cx.stroke();

  // Back arm
  cx.strokeStyle = '#4CAF50'; cx.lineWidth = 8;
  if (state === 'celebrate') {
    cx.beginPath(); cx.moveTo(mx - 30, bodyY - 15); cx.lineTo(mx - 55, bodyY - 70); cx.stroke();
  } else {
    cx.beginPath(); cx.moveTo(mx - 30, bodyY - 15); cx.lineTo(mx - 42, bodyY + 8); cx.stroke();
  }

  // ── Cricket pads (white leg guards) ──
  cx.beginPath(); cx.ellipse(mx - 18, legY - 30, 8, 22, 0, 0, Math.PI * 2);
  fillStroke(cx, '#fff', '#bbb', 2);
  cx.beginPath(); cx.ellipse(mx + 18, legY - 30, 8, 22, 0, 0, Math.PI * 2);
  fillStroke(cx, '#fff', '#bbb', 2);

  // ── Helmet ──
  cx.beginPath(); cx.arc(mx, headY - 22, headR * 0.65, Math.PI, 0);
  fillStroke(cx, '#1565C0', '#0D47A1', 3);
  cx.beginPath(); cx.ellipse(mx, headY - 22, headR * 0.68, 8, 0, Math.PI, 0);
  fillStroke(cx, '#1976D2', '#0D47A1', 2);

  return toTex(cv);
}

// ── Ball Glow — Subtle red halo ──────────────────────────────────────────────

function ballGlow(): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(BW, BH);
  const mx = BW / 2, my = BH / 2;
  const grad = cx.createRadialGradient(mx, my, 0, mx, my, 32);
  grad.addColorStop(0, "rgba(255, 100, 100, 0.8)");
  grad.addColorStop(0.4, "rgba(255, 50, 50, 0.3)");
  grad.addColorStop(1, "rgba(255, 0, 0, 0)");
  cx.fillStyle = grad;
  cx.fillRect(0, 0, BW, BH);
  return toTex(cv);
}

// ── Simple Drop Shadow — Dark ellipse ────────────────────────────────────────

function dropShadow(): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(BW, BH);
  const mx = BW / 2, my = BH / 2;
  const grad = cx.createRadialGradient(mx, my, 0, mx, my, 32);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.4)");
  grad.addColorStop(0.7, "rgba(0, 0, 0, 0.1)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  cx.fillStyle = grad;
  cx.fillRect(0, 0, BW, BH);
  return toTex(cv);
}

// ── Bowler — Caterpillar ──────────────────────────────────────────────────────

function bowler(state: BowlerState): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(W, H);
  const mx = W / 2;
  const headY = 110, baseY = 175;
  const segR = 26;
  const segs = 5;

  // ── Segments (alternating shades) ──
  for (let i = segs - 1; i >= 0; i--) {
    const sy = baseY + i * (segR * 1.5);
    const stride = state === 'run' ? Math.sin(i * 2.4) * 8 : 0;
    cx.beginPath(); cx.ellipse(mx + stride * 0.3, sy, segR + 4, segR, 0, 0, Math.PI * 2);
    fillStroke(cx, i % 2 === 0 ? '#2E7D32' : '#43A047', '#1B5E20', OL);

    // Legs per segment (3 pairs)
    if (i > 0 && i < 4) {
      cx.strokeStyle = '#1B5E20'; cx.lineWidth = 5;
      const lStride = state === 'run' ? Math.sin(i * 2.1 + 1) * 10 : 0;
      cx.beginPath(); cx.moveTo(mx - segR - 2, sy); cx.lineTo(mx - segR - 20, sy + 15 + lStride); cx.stroke();
      cx.beginPath(); cx.moveTo(mx + segR + 2, sy); cx.lineTo(mx + segR + 20, sy + 15 - lStride); cx.stroke();
      // Tiny feet
      cx.fillStyle = '#1B5E20';
      cx.beginPath(); cx.arc(mx - segR - 20, sy + 15 + lStride, 4, 0, Math.PI * 2); cx.fill();
      cx.beginPath(); cx.arc(mx + segR + 20, sy + 15 - lStride, 4, 0, Math.PI * 2); cx.fill();
    }
  }

  // ── Head (large, round — 40% of character) ──
  cx.beginPath(); cx.arc(mx, headY, 42, 0, Math.PI * 2);
  fillStroke(cx, '#66BB6A', '#1B5E20', 4);

  // ── EYES (huge) ──
  eye(cx, mx - 16, headY - 8, 15, 0, 0.6);
  eye(cx, mx + 16, headY - 8, 15, 0, 0.6);

  // ── Antennae ──
  cx.strokeStyle = '#1B5E20'; cx.lineWidth = 3.5;
  cx.beginPath(); cx.moveTo(mx - 14, headY - 38); cx.quadraticCurveTo(mx - 35, headY - 75, mx - 42, headY - 82); cx.stroke();
  cx.beginPath(); cx.moveTo(mx + 14, headY - 38); cx.quadraticCurveTo(mx + 35, headY - 75, mx + 42, headY - 82); cx.stroke();
  cx.fillStyle = '#FFC107';
  cx.beginPath(); cx.arc(mx - 42, headY - 82, 6, 0, Math.PI * 2); cx.fill();
  cx.beginPath(); cx.arc(mx + 42, headY - 82, 6, 0, Math.PI * 2); cx.fill();

  // ── Bowling arm ──
  cx.strokeStyle = '#2E7D32'; cx.lineWidth = 8;
  if (state === 'bowl' || state === 'release') {
    const a = state === 'release' ? 2.0 : -1.3;
    const ex = mx + 32 + Math.cos(a) * 45, ey = headY + 20 + Math.sin(a) * 45;
    cx.beginPath(); cx.moveTo(mx + 28, headY + 15); cx.lineTo(ex, ey); cx.stroke();
    if (state === 'bowl') {
      cx.beginPath(); cx.arc(ex, ey, 8, 0, Math.PI * 2);
      fillStroke(cx, '#E53935', '#B71C1C', 2);
      // Seam
      cx.strokeStyle = '#fff'; cx.lineWidth = 1.5;
      cx.beginPath(); cx.arc(ex, ey, 6, 0.5, 2.5); cx.stroke();
    }
  } else {
    cx.beginPath(); cx.moveTo(mx + 28, headY + 15); cx.lineTo(mx + 44, headY + 50); cx.stroke();
    cx.beginPath(); cx.moveTo(mx - 28, headY + 15); cx.lineTo(mx - 44, headY + 50); cx.stroke();
  }

  // ── Mouth ──
  cx.strokeStyle = '#1B5E20'; cx.lineWidth = 3;
  if (state === 'release') {
    cx.beginPath(); cx.arc(mx, headY + 14, 8, 0, Math.PI); cx.stroke(); // open mouth
  } else {
    cx.beginPath(); cx.moveTo(mx - 8, headY + 14); cx.lineTo(mx + 8, headY + 14); cx.stroke();
  }

  return toTex(cv);
}

// ── Fielders — Ladybugs, Snails, Beetles ──────────────────────────────────────

const FIELDER_DEFS = [
  { shell: '#E53935', head: '#222', spots: true },   // red ladybug
  { shell: '#8D6E63', head: '#A1887F', spots: false }, // brown snail
  { shell: '#FF7043', head: '#333', spots: true },     // orange ladybug
  { shell: '#5D4037', head: '#795548', spots: false },  // dark beetle
  { shell: '#7E57C2', head: '#9575CD', spots: false },  // purple beetle
  { shell: '#26A69A', head: '#004D40', spots: false },  // teal beetle
];

function fielder(variant: number): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(FW, FH);
  const pal = FIELDER_DEFS[variant % FIELDER_DEFS.length];
  const mx = FW / 2, bodyY = 90, headY = 52;

  // ── Legs ──
  cx.strokeStyle = '#333'; cx.lineWidth = 5;
  cx.beginPath(); cx.moveTo(mx - 22, bodyY + 8); cx.lineTo(mx - 32, bodyY + 35); cx.stroke();
  cx.beginPath(); cx.moveTo(mx + 22, bodyY + 8); cx.lineTo(mx + 32, bodyY + 35); cx.stroke();
  cx.fillStyle = '#333';
  cx.beginPath(); cx.arc(mx - 32, bodyY + 36, 5, 0, Math.PI * 2); cx.fill();
  cx.beginPath(); cx.arc(mx + 32, bodyY + 36, 5, 0, Math.PI * 2); cx.fill();

  // ── Shell / body ──
  cx.beginPath(); cx.ellipse(mx, bodyY, 34, 26, 0, 0, Math.PI * 2);
  fillStroke(cx, pal.shell, '#222', 4);

  if (pal.spots) {
    cx.fillStyle = '#111';
    for (const [sx, sy] of [[-14, -6], [10, -4], [-5, 10], [14, 10]]) {
      cx.beginPath(); cx.arc(mx + sx, bodyY + sy, 6, 0, Math.PI * 2); cx.fill();
    }
    cx.strokeStyle = '#111'; cx.lineWidth = 3;
    cx.beginPath(); cx.moveTo(mx, bodyY - 26); cx.lineTo(mx, bodyY + 26); cx.stroke();
  }

  // ── Head ──
  cx.beginPath(); cx.arc(mx, headY, 22, 0, Math.PI * 2);
  fillStroke(cx, pal.head, '#222', 4);

  // ── EYES (huge relative to head) ──
  eye(cx, mx - 10, headY - 4, 10, 0, 0);
  eye(cx, mx + 10, headY - 4, 10, 0, 0);

  // ── Antennae (short) ──
  cx.strokeStyle = '#333'; cx.lineWidth = 3;
  cx.beginPath(); cx.moveTo(mx - 10, headY - 20); cx.lineTo(mx - 18, headY - 36); cx.stroke();
  cx.beginPath(); cx.moveTo(mx + 10, headY - 20); cx.lineTo(mx + 18, headY - 36); cx.stroke();
  cx.fillStyle = '#555';
  cx.beginPath(); cx.arc(mx - 18, headY - 36, 4, 0, Math.PI * 2); cx.fill();
  cx.beginPath(); cx.arc(mx + 18, headY - 36, 4, 0, Math.PI * 2); cx.fill();

  return toTex(cv);
}

// ── Wicket Keeper — Frog ──────────────────────────────────────────────────────

function keeper(): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(W, H);
  const mx = W / 2, headY = 120, bodyY = 210;

  // ── Legs (crouched — thick) ──
  cx.beginPath(); cx.ellipse(mx - 26, 305, 16, 28, -0.2, 0, Math.PI * 2);
  fillStroke(cx, '#388E3C', '#1B5E20');
  cx.beginPath(); cx.ellipse(mx + 26, 305, 16, 28, 0.2, 0, Math.PI * 2);
  fillStroke(cx, '#388E3C', '#1B5E20');
  // Webbed feet
  cx.beginPath(); cx.ellipse(mx - 36, 332, 20, 8, -0.1, 0, Math.PI * 2);
  fillStroke(cx, '#2E7D32', '#1B5E20');
  cx.beginPath(); cx.ellipse(mx + 36, 332, 20, 8, 0.1, 0, Math.PI * 2);
  fillStroke(cx, '#2E7D32', '#1B5E20');

  // ── Body ──
  cx.beginPath(); cx.ellipse(mx, bodyY, 42, 40, 0, 0, Math.PI * 2);
  fillStroke(cx, '#4CAF50', '#2E7D32', 4);
  // White belly
  cx.beginPath(); cx.ellipse(mx, bodyY + 8, 28, 26, 0, 0, Math.PI * 2);
  cx.fillStyle = '#C8E6C9'; cx.fill();

  // ── Head (wide frog) ──
  cx.beginPath(); cx.ellipse(mx, headY, 48, 36, 0, 0, Math.PI * 2);
  fillStroke(cx, '#66BB6A', '#2E7D32', 4);

  // ── Bulging eyes (ON TOP of head — frog signature) ──
  eye(cx, mx - 22, headY - 26, 18, 0, 0.6);
  eye(cx, mx + 22, headY - 26, 18, 0, 0.6);

  // Wide grin
  cx.strokeStyle = '#1B5E20'; cx.lineWidth = 3.5;
  cx.beginPath(); cx.arc(mx, headY + 10, 20, 0.15, Math.PI - 0.15); cx.stroke();

  // ── Gloved arms ──
  cx.strokeStyle = '#4CAF50'; cx.lineWidth = 9;
  cx.beginPath(); cx.moveTo(mx - 38, bodyY - 10); cx.lineTo(mx - 68, bodyY - 40); cx.stroke();
  cx.beginPath(); cx.moveTo(mx + 38, bodyY - 10); cx.lineTo(mx + 68, bodyY - 40); cx.stroke();
  // Glove pads
  cx.beginPath(); cx.arc(mx - 70, bodyY - 44, 14, 0, Math.PI * 2);
  fillStroke(cx, '#FFEB3B', '#F9A825', 3);
  cx.beginPath(); cx.arc(mx + 70, bodyY - 44, 14, 0, Math.PI * 2);
  fillStroke(cx, '#FFEB3B', '#F9A825', 3);

  return toTex(cv);
}

// ── Crowd ─────────────────────────────────────────────────────────────────────

const CROWD_COLS = ['#8D6E63','#66BB6A','#FF7043','#42A5F5','#AB47BC','#FFA726','#26A69A','#EC407A','#78909C','#FFCA28'];

function audience(v: number): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(48, 48);
  const col = CROWD_COLS[v % CROWD_COLS.length];
  const mx = 24, my = 28;
  // Body blob with outline
  cx.beginPath(); cx.ellipse(mx, my, 16, 14, 0, 0, Math.PI * 2);
  fillStroke(cx, col, '#333', 2.5);
  // Big eyes
  eye(cx, mx - 6, my - 4, 6, 0, 0);
  eye(cx, mx + 6, my - 4, 6, 0, 0);
  return toTex(cv);
}

// ── Cloud ─────────────────────────────────────────────────────────────────────

function cloud(): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(256, 128);
  cx.fillStyle = '#ffffff';
  cx.strokeStyle = '#7ab4d2';
  cx.lineWidth = 6;
  cx.globalAlpha = 1;
  cx.beginPath(); cx.ellipse(128, 80, 80, 35, 0, 0, Math.PI * 2); cx.fill(); cx.stroke();
  cx.beginPath(); cx.ellipse(85, 65, 50, 30, 0, 0, Math.PI * 2); cx.fill(); cx.stroke();
  cx.beginPath(); cx.ellipse(170, 70, 55, 28, 0, 0, Math.PI * 2); cx.fill(); cx.stroke();
  cx.beginPath(); cx.ellipse(120, 55, 40, 22, 0, 0, Math.PI * 2); cx.fill(); cx.stroke();
  return toTex(cv);
}

// ── Wheat fence ───────────────────────────────────────────────────────────────

function wheat(): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(64, 128);
  for (let i = 0; i < 8; i++) {
    const x = 6 + i * 7 + (i % 2) * 2;
    cx.strokeStyle = i % 2 === 0 ? '#8BC34A' : '#689F38'; cx.lineWidth = 2.5;
    cx.beginPath(); cx.moveTo(x, 128);
    cx.quadraticCurveTo(x + (i % 3 - 1) * 4, 60, x + (i % 2 === 0 ? -3 : 3), 15); cx.stroke();
    cx.fillStyle = '#FDD835';
    cx.beginPath(); cx.ellipse(x + (i % 2 === 0 ? -3 : 3), 14, 3.5, 8, (i % 3 - 1) * 0.2, 0, Math.PI * 2); cx.fill();
  }
  return toTex(cv);
}

// ── Public API ────────────────────────────────────────────────────────────────

export class DoodleAssets {
  readonly batsman: Record<BatsmanState, THREE.CanvasTexture>;
  readonly bowler: Record<BowlerState, THREE.CanvasTexture>;
  readonly fielders: THREE.CanvasTexture[];
  readonly keeper: THREE.CanvasTexture;
  readonly audience: THREE.CanvasTexture[];
  readonly cloud: THREE.CanvasTexture;
  readonly wheat: THREE.CanvasTexture;
  readonly ballGlow: THREE.CanvasTexture;
  readonly shadow: THREE.CanvasTexture;

  constructor() {
    this.batsman = {
      idle: batsman('idle'), swing1: batsman('swing1'), swing2: batsman('swing2'),
      celebrate: batsman('celebrate'), stumped: batsman('stumped'),
    };
    this.bowler = { idle: bowler('idle'), run: bowler('run'), bowl: bowler('bowl'), release: bowler('release') };
    this.fielders = FIELDER_DEFS.map((_, i) => fielder(i));
    this.keeper = keeper();
    this.audience = CROWD_COLS.map((_, i) => audience(i));
    this.cloud = cloud();
    this.wheat = wheat();
    this.ballGlow = ballGlow();
    this.shadow = dropShadow();
  }

  dispose() {
    const all: THREE.CanvasTexture[] = [
      ...Object.values(this.batsman), ...Object.values(this.bowler),
      ...this.fielders, this.keeper, ...this.audience, this.cloud, this.wheat,
      this.ballGlow, this.shadow
    ];
    for (const t of all) t.dispose();
  }
}
