import * as THREE from 'three';

// ── DoodleAssets — Flat illustrated characters (single coherent shapes) ───────
// All textures generated ONCE at init. Never per-frame.
// Style: soft same-hue strokes only (no black rims), 2–3 flat fills, clear silhouette.

const W = 256, H = 384;   // 2× bigger canvas for crisp characters
const FW = 160, FH = 160; // fielder canvas
const BW = 64, BH = 64;   // ball/shadow canvas
const OL = 1.15;          // light outline width (flat look)
const STROKE_ALPHA = 0.48;
const CHAR_TOP = 22;
const CHAR_HEIGHT = 330;
const HEAD_H = CHAR_HEIGHT * 0.45;
const BODY_H = CHAR_HEIGHT * 0.35;
const LEGS_H = CHAR_HEIGHT * 0.20;

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
  const prevAlpha = cx.globalAlpha;
  cx.globalAlpha = STROKE_ALPHA;
  cx.strokeStyle = stroke;
  cx.lineWidth = lw;
  cx.stroke();
  cx.globalAlpha = prevAlpha;
}

function darken(hex: string, amt = 0.14): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.floor(((n >> 16) & 255) * (1 - amt))));
  const g = Math.max(0, Math.min(255, Math.floor(((n >> 8) & 255) * (1 - amt))));
  const b = Math.max(0, Math.min(255, Math.floor((n & 255) * (1 - amt))));
  return `rgb(${r}, ${g}, ${b})`;
}

function roundCapsule(
  cx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  fill: string,
  stroke: string,
) {
  cx.strokeStyle = fill;
  cx.lineWidth = width;
  cx.beginPath();
  cx.moveTo(x1, y1);
  cx.lineTo(x2, y2);
  cx.stroke();
  const prevAlpha = cx.globalAlpha;
  cx.globalAlpha = STROKE_ALPHA * 0.85;
  cx.strokeStyle = stroke;
  cx.lineWidth = Math.max(1, width * 0.16);
  cx.beginPath();
  cx.moveTo(x1, y1);
  cx.lineTo(x2, y2);
  cx.stroke();
  cx.globalAlpha = prevAlpha;
}

/** Big expressive eye — THE dominant feature */
function eye(cx: CanvasRenderingContext2D, x: number, y: number, r: number, lx = 0, ly = 0) {
  // White sclera — stroke tinted cool grey, not black
  cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2);
  fillStroke(cx, '#fff', '#d0d5dc', Math.max(0.8, r * 0.12));
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

type RoleStyle = {
  outlineWidth: number;
  headTilt: number;
  bodyTilt: number;
};

const ROLE_STYLE: Record<'batsman' | 'bowler' | 'fielder', RoleStyle> = {
  batsman: { outlineWidth: 1.15, headTilt: 0.04, bodyTilt: -0.14 },
  bowler: { outlineWidth: 1.05, headTilt: 0.03, bodyTilt: -0.1 },
  fielder: { outlineWidth: 0.95, headTilt: 0.02, bodyTilt: -0.05 },
};

function batsman(state: BatsmanState): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(W, H);
  const mx = W / 2;
  const role = ROLE_STYLE.batsman;
  const base = '#4FAE64';
  const stroke = darken(base);
  const bodyShade = '#74C17C';
  const headCY = CHAR_TOP + HEAD_H * 0.48;
  const bodyTop = CHAR_TOP + HEAD_H - 8;
  const bodyCY = bodyTop + BODY_H * 0.55;
  const legTop = bodyTop + BODY_H - 6;
  const headW = HEAD_H * 0.70;
  const headH = HEAD_H * 0.58;

  // Frog: one continuous head–body read (organic head blob + integrated eyes)
  cx.beginPath();
  cx.moveTo(mx - headW * 0.55, headCY + headH * 0.05);
  cx.bezierCurveTo(mx - headW * 0.72, headCY - headH * 0.35, mx - headW * 0.28, headCY - headH * 0.62, mx, headCY - headH * 0.58);
  cx.bezierCurveTo(mx + headW * 0.3, headCY - headH * 0.64, mx + headW * 0.72, headCY - headH * 0.34, mx + headW * 0.56, headCY + headH * 0.08);
  cx.bezierCurveTo(mx + headW * 0.64, headCY + headH * 0.42, mx + headW * 0.28, headCY + headH * 0.62, mx, headCY + headH * 0.56);
  cx.bezierCurveTo(mx - headW * 0.28, headCY + headH * 0.62, mx - headW * 0.62, headCY + headH * 0.42, mx - headW * 0.55, headCY + headH * 0.05);
  fillStroke(cx, base, stroke, role.outlineWidth);

  // Frog eyes on top
  eye(cx, mx - 26, headCY - 38, 17, 0.28, 0.08);
  eye(cx, mx + 24, headCY - 40, 17, -0.28, 0.08);

  // Wide frog mouth
  cx.strokeStyle = stroke; cx.lineWidth = 3;
  cx.beginPath();
  if (state === 'stumped') cx.arc(mx + 2, headCY + 20, 17, Math.PI + 0.2, -0.2);
  else cx.arc(mx + 2, headCY + 16, 18, 0.2, Math.PI - 0.2);
  cx.stroke();

  // Squat body
  cx.beginPath();
  cx.ellipse(mx - 4, bodyCY, 44, BODY_H * 0.46, -0.16, 0, Math.PI * 2);
  fillStroke(cx, bodyShade, darken(bodyShade, 0.12), role.outlineWidth);

  // Limbs as thick capsules
  roundCapsule(cx, mx - 26, bodyCY + 8, mx - 36, legTop + LEGS_H * 0.63, 16, base, stroke);
  roundCapsule(cx, mx + 20, bodyCY + 10, mx + 42, legTop + LEGS_H * 0.58, 16, base, stroke);

  // Feet
  cx.beginPath(); cx.ellipse(mx - 40, legTop + LEGS_H * 0.74, 18, 10, -0.16, 0, Math.PI * 2); fillStroke(cx, base, stroke, role.outlineWidth);
  cx.beginPath(); cx.ellipse(mx + 48, legTop + LEGS_H * 0.66, 18, 10, 0.16, 0, Math.PI * 2); fillStroke(cx, base, stroke, role.outlineWidth);

  // Bat hand anchor
  const handX = mx + 36;
  const handY = bodyCY - 20;
  const batAngle = state === 'swing2' ? 1.0 : state === 'swing1' ? 0.3 : -0.55;
  const gripX = handX + Math.cos(batAngle) * 22;
  const gripY = handY + Math.sin(batAngle) * 22;
  const bladeX = gripX + Math.cos(batAngle - 0.12) * 62;
  const bladeY = gripY + Math.sin(batAngle - 0.12) * 62;

  // Arm to bat (anchored)
  roundCapsule(cx, mx + 16, bodyCY - 10, handX, handY, 14, base, stroke);
  cx.beginPath(); cx.arc(handX, handY, 8, 0, Math.PI * 2); fillStroke(cx, '#DCEAD6', darken('#DCEAD6', 0.1), 1);

  // Bat with thickness
  roundCapsule(cx, handX, handY, gripX, gripY, 9, '#7B5A3D', darken('#7B5A3D'));
  cx.strokeStyle = '#E9DDCD'; cx.lineWidth = 16;
  cx.beginPath(); cx.moveTo(gripX, gripY); cx.lineTo(bladeX, bladeY); cx.stroke();
  cx.strokeStyle = '#B5A089'; cx.lineWidth = 3;
  cx.beginPath(); cx.moveTo(gripX + 2, gripY + 2); cx.lineTo(bladeX - 2, bladeY - 2); cx.stroke();

  // Rear arm
  roundCapsule(
    cx,
    mx - 18, bodyCY - 12,
    mx - 42, bodyCY + (state === 'celebrate' ? -36 : 12),
    12,
    base,
    stroke,
  );

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
  const role = ROLE_STYLE.bowler;
  const base = '#D57A44';
  const stroke = darken(base);
  const accent = '#F4E4CE';
  const headCY = CHAR_TOP + HEAD_H * 0.5;
  const bodyTop = CHAR_TOP + HEAD_H - 12;
  const bodyCY = bodyTop + BODY_H * 0.5;
  const legTop = bodyTop + BODY_H - 10;
  const lean = state === 'run' || state === 'bowl' || state === 'release' ? -16 : -8;
  const headR = HEAD_H * 0.34;

  cx.save();
  cx.translate(mx + lean, 0);

  // Legs as capsules
  roundCapsule(cx, -16, legTop, -22, legTop + LEGS_H * 0.84, 14, base, stroke);
  roundCapsule(cx, 16, legTop, 22, legTop + LEGS_H * 0.82, 14, base, stroke);
  cx.beginPath(); cx.ellipse(-24, legTop + LEGS_H * 0.88, 14, 8, -0.08, 0, Math.PI * 2); fillStroke(cx, base, stroke, 3);
  cx.beginPath(); cx.ellipse(24, legTop + LEGS_H * 0.88, 14, 8, 0.08, 0, Math.PI * 2); fillStroke(cx, base, stroke, 3);

  // Body
  cx.beginPath(); cx.ellipse(0, bodyCY, 40, BODY_H * 0.52, -0.12, 0, Math.PI * 2);
  fillStroke(cx, base, stroke, role.outlineWidth);
  cx.beginPath(); cx.ellipse(0, bodyCY + 10, 24, BODY_H * 0.24, 0, 0, Math.PI * 2);
  fillStroke(cx, accent, darken(accent, 0.12), role.outlineWidth);

  // Head
  cx.beginPath(); cx.ellipse(0, headCY, headR * 1.02, headR * 0.88, 0.05, 0, Math.PI * 2);
  fillStroke(cx, base, stroke, role.outlineWidth);
  // Fox/cat ears
  cx.beginPath();
  cx.moveTo(-20, headCY - 34);
  cx.lineTo(-10, headCY - 56);
  cx.lineTo(0, headCY - 34);
  fillStroke(cx, base, stroke, role.outlineWidth);
  cx.beginPath();
  cx.moveTo(20, headCY - 34);
  cx.lineTo(10, headCY - 56);
  cx.lineTo(0, headCY - 34);
  fillStroke(cx, base, stroke, role.outlineWidth);
  eye(cx, -16, headCY - 10, 14, -0.18, -0.08);
  eye(cx, 16, headCY - 10, 14, -0.16, -0.08);

  // Aggressive eyebrow
  cx.strokeStyle = stroke; cx.lineWidth = 4;
  cx.beginPath(); cx.moveTo(-26, headCY - 26); cx.lineTo(-8, headCY - 30); cx.stroke();
  cx.beginPath(); cx.moveTo(8, headCY - 30); cx.lineTo(26, headCY - 26); cx.stroke();

  // Arms / bowling pose
  const raisedA = state === 'release' ? -2.2 : state === 'bowl' ? -1.5 : -0.7;
  const ex = 30 + Math.cos(raisedA) * 56;
  const ey = bodyCY - 28 + Math.sin(raisedA) * 56;
  roundCapsule(cx, 30, bodyCY - 22, ex, ey, 12, base, stroke);
  roundCapsule(cx, -30, bodyCY - 18, -48, bodyCY + 12, 11, base, stroke);
  if (state === 'bowl') {
    cx.beginPath(); cx.arc(ex, ey, 8, 0, Math.PI * 2); fillStroke(cx, '#D73A33', '#8B1812', 2);
  }
  cx.restore();

  return toTex(cv);
}

// ── Fielders — Distinct archetypes (fox, bear, hopper, rabbit) ────────────────

function fielderFox(): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(FW, FH);
  const role = ROLE_STYLE.fielder;
  const shell = '#A2714F';
  const head = '#8E603F';
  const stroke = darken(shell, 0.16);
  const mx = FW / 2;
  const headY = 52;
  const bodyY = 92;

  cx.save(); cx.translate(mx, 0);
  cx.beginPath(); cx.ellipse(0, bodyY, 25, 22, 0, 0, Math.PI * 2);
  fillStroke(cx, shell, stroke, role.outlineWidth);
  cx.beginPath(); cx.ellipse(0, headY, 19, 15, 0, 0, Math.PI * 2);
  fillStroke(cx, head, darken(head, 0.14), role.outlineWidth);
  cx.beginPath(); cx.moveTo(-14, 42); cx.lineTo(-8, 24); cx.lineTo(-1, 42); fillStroke(cx, head, darken(head, 0.14), role.outlineWidth);
  cx.beginPath(); cx.moveTo(14, 42); cx.lineTo(8, 24); cx.lineTo(1, 42); fillStroke(cx, head, darken(head, 0.14), role.outlineWidth);
  eye(cx, -7, 50, 6.6, -0.12, 0.05);
  eye(cx, 7, 50, 6.6, -0.08, 0.05);
  roundCapsule(cx, -11, 108, -15, 124, 7, shell, stroke);
  roundCapsule(cx, 11, 108, 15, 124, 7, shell, stroke);
  cx.restore();
  return toTex(cv);
}

function fielderBear(): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(FW, FH);
  const role = ROLE_STYLE.fielder;
  const body = '#8E7663';
  const head = '#7C6554';
  const stroke = darken(body, 0.15);
  const mx = FW / 2;

  cx.save(); cx.translate(mx, 0);
  cx.beginPath(); cx.ellipse(0, 94, 28, 24, 0, 0, Math.PI * 2);
  fillStroke(cx, body, stroke, role.outlineWidth);
  cx.beginPath(); cx.ellipse(0, 58, 20, 17, 0, 0, Math.PI * 2);
  fillStroke(cx, head, darken(head, 0.14), role.outlineWidth);
  cx.beginPath(); cx.arc(-12, 42, 6, 0, Math.PI * 2); fillStroke(cx, head, darken(head, 0.14), 1);
  cx.beginPath(); cx.arc(12, 42, 6, 0, Math.PI * 2); fillStroke(cx, head, darken(head, 0.14), 1);
  eye(cx, -7, 58, 6.2, -0.1, 0.03);
  eye(cx, 7, 58, 6.2, -0.1, 0.03);
  roundCapsule(cx, -12, 110, -17, 126, 8, body, stroke);
  roundCapsule(cx, 12, 110, 17, 126, 8, body, stroke);
  cx.restore();
  return toTex(cv);
}

function fielderHopper(): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(FW, FH);
  const role = ROLE_STYLE.fielder;
  const body = '#6B9A58';
  const head = '#7FAE66';
  const stroke = darken(body, 0.16);
  const mx = FW / 2;

  cx.save(); cx.translate(mx, 0);
  cx.beginPath(); cx.ellipse(0, 96, 22, 20, 0, 0, Math.PI * 2);
  fillStroke(cx, body, stroke, role.outlineWidth);
  cx.beginPath(); cx.ellipse(0, 63, 17, 14, 0.08, 0, Math.PI * 2);
  fillStroke(cx, head, darken(head, 0.14), role.outlineWidth);
  roundCapsule(cx, -8, 106, -20, 126, 7, body, stroke);
  roundCapsule(cx, 8, 106, 20, 126, 7, body, stroke);
  cx.beginPath(); cx.moveTo(-7, 54); cx.lineTo(-14, 40); cx.lineTo(-9, 54); fillStroke(cx, head, darken(head, 0.14), 1);
  cx.beginPath(); cx.moveTo(7, 54); cx.lineTo(14, 40); cx.lineTo(9, 54); fillStroke(cx, head, darken(head, 0.14), 1);
  eye(cx, -6, 63, 6, -0.1, 0.05);
  eye(cx, 7, 63, 6, -0.1, 0.05);
  cx.restore();
  return toTex(cv);
}

function fielderRabbit(): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(FW, FH);
  const role = ROLE_STYLE.fielder;
  const body = '#9B8FA4';
  const head = '#B5A8BF';
  const stroke = darken(body, 0.16);
  const mx = FW / 2;

  cx.save(); cx.translate(mx, 0);
  cx.beginPath(); cx.ellipse(0, 98, 20, 19, 0, 0, Math.PI * 2);
  fillStroke(cx, body, stroke, role.outlineWidth);
  cx.beginPath(); cx.ellipse(0, 65, 16, 14, 0, 0, Math.PI * 2);
  fillStroke(cx, head, darken(head, 0.14), role.outlineWidth);
  cx.beginPath(); cx.ellipse(-7, 44, 4, 13, -0.08, 0, Math.PI * 2); fillStroke(cx, head, darken(head, 0.14), 1);
  cx.beginPath(); cx.ellipse(7, 44, 4, 13, 0.08, 0, Math.PI * 2); fillStroke(cx, head, darken(head, 0.14), 1);
  eye(cx, -6, 65, 5.8, -0.1, 0.04);
  eye(cx, 6, 65, 5.8, -0.1, 0.04);
  roundCapsule(cx, -7, 111, -10, 126, 6, body, stroke);
  roundCapsule(cx, 7, 111, 10, 126, 6, body, stroke);
  cx.restore();
  return toTex(cv);
}

// ── Wicket Keeper — Frog ──────────────────────────────────────────────────────

function keeper(): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(W, H);
  const mx = W / 2;
  const base = '#5AAA68';
  const stroke = darken(base);
  const glove = '#F3DB4A';
  const headCY = CHAR_TOP + HEAD_H * 0.5;
  const bodyTop = CHAR_TOP + HEAD_H - 10;
  const bodyCY = bodyTop + BODY_H * 0.52;
  const legTop = bodyTop + BODY_H - 14;

  cx.beginPath(); cx.ellipse(mx, headCY, HEAD_H * 0.36, HEAD_H * 0.29, 0, 0, Math.PI * 2);
  fillStroke(cx, base, stroke, 4);
  eye(cx, mx - 22, headCY - 18, 16, 0.1, 0.25);
  eye(cx, mx + 22, headCY - 18, 16, 0.1, 0.25);
  cx.strokeStyle = stroke; cx.lineWidth = 3;
  cx.beginPath(); cx.arc(mx, headCY + 14, 16, 0.2, Math.PI - 0.2); cx.stroke();

  cx.beginPath(); cx.ellipse(mx, bodyCY, 40, BODY_H * 0.45, 0, 0, Math.PI * 2);
  fillStroke(cx, base, stroke, 4);

  cx.strokeStyle = stroke; cx.lineWidth = 12;
  cx.beginPath(); cx.moveTo(mx - 18, legTop); cx.lineTo(mx - 32, legTop + LEGS_H * 0.85); cx.stroke();
  cx.beginPath(); cx.moveTo(mx + 18, legTop); cx.lineTo(mx + 32, legTop + LEGS_H * 0.85); cx.stroke();
  cx.beginPath(); cx.ellipse(mx - 38, legTop + LEGS_H * 0.9, 18, 7, -0.1, 0, Math.PI * 2); fillStroke(cx, base, stroke);
  cx.beginPath(); cx.ellipse(mx + 38, legTop + LEGS_H * 0.9, 18, 7, 0.1, 0, Math.PI * 2); fillStroke(cx, base, stroke);

  cx.strokeStyle = stroke; cx.lineWidth = 9;
  cx.beginPath(); cx.moveTo(mx - 36, bodyCY - 10); cx.lineTo(mx - 68, bodyCY - 42); cx.stroke();
  cx.beginPath(); cx.moveTo(mx + 36, bodyCY - 10); cx.lineTo(mx + 68, bodyCY - 42); cx.stroke();
  cx.beginPath(); cx.arc(mx - 72, bodyCY - 46, 12, 0, Math.PI * 2); fillStroke(cx, glove, darken(glove), 3);
  cx.beginPath(); cx.arc(mx + 72, bodyCY - 46, 12, 0, Math.PI * 2); fillStroke(cx, glove, darken(glove), 3);

  return toTex(cv);
}

// ── Crowd ─────────────────────────────────────────────────────────────────────

const CROWD_COLS = ['#8D6E63','#66BB6A','#FF7043','#42A5F5','#AB47BC','#FFA726','#26A69A','#EC407A','#78909C','#FFCA28'];
const CROWD_SKIN = ['#FDBCB4','#F1C27D','#E0AC69','#C68642','#8D5524','#FDBCB4','#F1C27D','#C68642','#FDBCB4','#E0AC69'];

function audienceSilhouette(v: number, pose: 'idle' | 'celebrate'): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(48, 80);
  const col  = CROWD_COLS[v % CROWD_COLS.length]!;
  const skin = CROWD_SKIN[v % CROWD_SKIN.length]!;
  const dark = darken(col, 0.30);
  const mid  = 24;

  // Head
  cx.beginPath();
  cx.ellipse(mid, 10, 7, 8, 0, 0, Math.PI * 2);
  fillStroke(cx, skin, darken(skin, 0.18), 1);

  // Neck
  cx.fillStyle = skin;
  cx.fillRect(mid - 3, 17, 6, 4);

  // Torso / jersey
  cx.beginPath();
  if (cx.roundRect) {
    cx.roundRect(mid - 9, 21, 18, 20, 2);
  } else {
    cx.rect(mid - 9, 21, 18, 20);
  }
  fillStroke(cx, col, dark, 1);

  cx.strokeStyle = dark;
  cx.lineWidth = 3.5;
  cx.lineCap = 'round';

  if (pose === 'idle') {
    // Arms — angled outward at rest
    cx.beginPath(); cx.moveTo(mid - 8, 25); cx.lineTo(mid - 14, 38); cx.stroke();
    cx.beginPath(); cx.moveTo(mid + 8, 25); cx.lineTo(mid + 14, 38); cx.stroke();
    // Legs
    cx.lineWidth = 4;
    cx.beginPath(); cx.moveTo(mid - 4, 41); cx.lineTo(mid - 6, 64); cx.stroke();
    cx.beginPath(); cx.moveTo(mid + 4, 41); cx.lineTo(mid + 6, 64); cx.stroke();
    // Feet
    cx.lineWidth = 3;
    cx.beginPath(); cx.moveTo(mid - 6, 64); cx.lineTo(mid - 10, 67); cx.stroke();
    cx.beginPath(); cx.moveTo(mid + 6, 64); cx.lineTo(mid + 10, 67); cx.stroke();
  } else {
    // Arms raised in V-shape (celebrate / jump)
    cx.beginPath(); cx.moveTo(mid - 8, 25); cx.lineTo(mid - 19,  6); cx.stroke();
    cx.beginPath(); cx.moveTo(mid + 8, 25); cx.lineTo(mid + 19,  6); cx.stroke();
    // Fists at tip
    cx.fillStyle = skin;
    cx.beginPath(); cx.arc(mid - 19, 5, 3.5, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(mid + 19, 5, 3.5, 0, Math.PI * 2); cx.fill();
    // Legs slightly bent (energy)
    cx.lineWidth = 4;
    cx.strokeStyle = dark;
    cx.beginPath(); cx.moveTo(mid - 4, 41); cx.lineTo(mid - 9, 62); cx.stroke();
    cx.beginPath(); cx.moveTo(mid + 4, 41); cx.lineTo(mid + 9, 62); cx.stroke();
    // Feet
    cx.lineWidth = 3;
    cx.beginPath(); cx.moveTo(mid - 9, 62); cx.lineTo(mid - 13, 65); cx.stroke();
    cx.beginPath(); cx.moveTo(mid + 9, 62); cx.lineTo(mid + 13, 65); cx.stroke();
  }
  return toTex(cv);
}

// ── Cloud ─────────────────────────────────────────────────────────────────────

function cloud(): THREE.CanvasTexture {
  const [cv, cx] = makeCanvas(256, 128);
  cx.fillStyle = '#ffffff';
  cx.strokeStyle = '#a8c9e0';
  cx.lineWidth = 3.5;
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
  readonly audienceCelebrate: THREE.CanvasTexture[];
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
    this.fielders = [fielderFox(), fielderBear(), fielderHopper(), fielderRabbit()];
    this.keeper = keeper();
    this.audience          = CROWD_COLS.map((_, i) => audienceSilhouette(i, 'idle'));
    this.audienceCelebrate = CROWD_COLS.map((_, i) => audienceSilhouette(i, 'celebrate'));
    this.cloud = cloud();
    this.wheat = wheat();
    this.ballGlow = ballGlow();
    this.shadow = dropShadow();
  }

  dispose() {
    const all: THREE.CanvasTexture[] = [
      ...Object.values(this.batsman), ...Object.values(this.bowler),
      ...this.fielders, this.keeper, ...this.audience, ...this.audienceCelebrate, this.cloud, this.wheat,
      this.ballGlow, this.shadow
    ];
    for (const t of all) t.dispose();
  }
}
