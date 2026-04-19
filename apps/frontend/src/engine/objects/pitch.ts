import * as THREE from 'three';

/**
 * Creates a mow-stripe canvas texture for a 140×140 world-unit ground plane.
 * Includes: alternating mow bands, boundary ring (r=35), 30-yard inner circle (r=15).
 */
function makeGroundTexture(): THREE.CanvasTexture {
  const SIZE = 1024;
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext('2d')!;

  // Mow stripes — alternating bands parallel to Z axis (vertical in top-down texture)
  const BAND = 24; // pixels ≈ 3.3 world units per stripe
  for (let b = 0; b * BAND < SIZE; b++) {
    ctx.fillStyle = b % 2 === 0 ? '#133618' : '#1a4820';
    ctx.fillRect(0, b * BAND, SIZE, BAND);
  }

  // Subtle radial vignette from center — darker at edges
  const CX = SIZE / 2, CY = SIZE / 2;
  const vignette = ctx.createRadialGradient(CX, CY, SIZE * 0.3, CX, CY, SIZE * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Pixels per world unit: SIZE / groundWidth = 1024 / 140
  const PPU = SIZE / 140;

  // 30-yard inner circle (dashed white)
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 14]);
  ctx.beginPath();
  ctx.arc(CX, CY, 15 * PPU, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Boundary ring (solid white, slightly glowing)
  ctx.save();
  ctx.shadowBlur = 8;
  ctx.shadowColor = 'rgba(255,255,255,0.6)';
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 3.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(CX, CY, 35 * PPU, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePitchTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0,   '#c9a574');
  grd.addColorStop(0.5, '#d2b08a');
  grd.addColorStop(1,   '#a88458');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 80; i++) {
    g.fillStyle = `rgba(90,60,30,${0.05 + Math.random() * 0.08})`;
    g.fillRect(Math.random() * 256, Math.random() * 64, 8, 2);
  }
  // Crease lines
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, 10); g.lineTo(256, 10); g.stroke();
  g.beginPath(); g.moveTo(0, 54); g.lineTo(256, 54); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface PitchBundle {
  ground: THREE.Mesh;
  pitch: THREE.Mesh;
  boundary: THREE.Line;
  innerCircle: THREE.Line;
}

export function createPitch(): PitchBundle {
  const groundTex = makeGroundTexture();
  const pitchTex  = makePitchTexture();

  // Full-size outfield — 140×140 world units, texture drawn without repeat
  const groundGeo = new THREE.PlaneGeometry(140, 140);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: 0.92,
    metalness: 0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;

  // Clay pitch strip (20 world units long, 3 wide)
  const pitchGeo = new THREE.PlaneGeometry(3, 20);
  const pitchMat = new THREE.MeshStandardMaterial({
    map: pitchTex,
    roughness: 0.88,
    metalness: 0,
  });
  const pitch = new THREE.Mesh(pitchGeo, pitchMat);
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(0, 0.02, 0);
  pitch.receiveShadow = true;

  // Boundary rope line at r=35
  const boundaryCurve = new THREE.EllipseCurve(0, 0, 35, 35, 0, Math.PI * 2, false, 0);
  const boundaryPts = boundaryCurve.getPoints(120).map(p => new THREE.Vector3(p.x, 0.05, p.y));
  const boundary = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(boundaryPts),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
  );

  // 30-yard fielding circle at r=15 (dashed via low opacity)
  const innerCurve = new THREE.EllipseCurve(0, 0, 15, 15, 0, Math.PI * 2, false, 0);
  const innerPts = innerCurve.getPoints(80).map(p => new THREE.Vector3(p.x, 0.05, p.y));
  const innerCircle = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(innerPts),
    new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, dashSize: 1.2, gapSize: 1.8 })
  );
  innerCircle.computeLineDistances();

  return { ground, pitch, boundary, innerCircle };
}
