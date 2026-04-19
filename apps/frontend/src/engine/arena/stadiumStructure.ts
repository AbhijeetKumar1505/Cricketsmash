import * as THREE from 'three';

function makeSeatingTexture(tier: number): THREE.CanvasTexture {
  const W = 1024, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#0a120a';
  ctx.fillRect(0, 0, W, H);

  const ROW_H = 13, ROW_GAP = 5, SEAT_W = 9, SEAT_GAP = 2;
  // Per-tier dominant color palette
  const palettes = [
    ['#2d5a3d', '#3a7a50', '#4a9e6a', '#1e3d2a', '#245a35'],
    ['#1e3d55', '#2a5a7a', '#1a3040', '#3a7a9e', '#1a4a6a'],
    ['#3a1e2d', '#5a2a3d', '#7a3a50', '#2a1a20', '#4a2235'],
  ];
  const colors = palettes[tier % 3]!;

  for (let row = 0; row * (ROW_H + ROW_GAP) < H; row++) {
    const y = row * (ROW_H + ROW_GAP);
    for (let col = 0; col * (SEAT_W + SEAT_GAP) < W; col++) {
      const x = col * (SEAT_W + SEAT_GAP);
      const ci = (row * 7 + col * 13 + tier * 3) % colors.length;
      ctx.fillStyle = colors[ci]!;
      ctx.fillRect(x, y, SEAT_W, ROW_H);
      // Occasional lit spectator
      if ((row * 31 + col * 17 + tier * 5) % 19 === 0) {
        ctx.fillStyle = 'rgba(255,240,180,0.9)';
        ctx.fillRect(x + 3, y + 3, 3, 4);
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeAdBoardTexture(idx: number): THREE.CanvasTexture {
  const W = 512, H = 64;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;

  type BoardDef = { bg: string; fg: string; text: string };
  const boards: BoardDef[] = [
    { bg: '#00a651', fg: '#ffffff', text: '◆ CRICKET CRASH ◆' },
    { bg: '#c8102e', fg: '#ffffff', text: '★  BET LIVE  ★' },
    { bg: '#f7941d', fg: '#1a1a1a', text: '⚡ POWERPLAY ⚡' },
    { bg: '#1a1a2e', fg: '#e94560', text: '▶ SMASH ZONE ◀' },
    { bg: '#0d2137', fg: '#00d4ff', text: '◉ LIVE BETTING ◉' },
    { bg: '#2d1a3a', fg: '#c084fc', text: '✦ ULTRA MULTI ✦' },
  ];
  const b = boards[idx % boards.length]!;

  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0,   b.bg + 'bb');
  grad.addColorStop(0.5, b.bg);
  grad.addColorStop(1,   b.bg + 'bb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = b.fg + '44';
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  ctx.shadowBlur = 14;
  ctx.shadowColor = b.fg;
  ctx.fillStyle = b.fg;
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.text, W / 2, H / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface StadiumStructure {
  group: THREE.Group;
  floodlightLights: THREE.SpotLight[];
  dispose: () => void;
}

export function createStadiumStructure(): StadiumStructure {
  const group = new THREE.Group();
  const floodlightLights: THREE.SpotLight[] = [];
  const toDispose: { dispose(): void }[] = [];

  // ─── Three-tier stadium bowl ───
  // CylinderGeometry(rTop, rBot, h) rendered BackSide — interior seating face visible
  const tierDefs = [
    { rBot: 38, rTop: 48, h: 10, yBot: 0.5,  tx: 10, ty: 1.0 },
    { rBot: 50, rTop: 62, h: 12, yBot: 10.5, tx: 12, ty: 1.0 },
    { rBot: 64, rTop: 78, h: 14, yBot: 22.5, tx: 14, ty: 1.0 },
  ];

  for (let ti = 0; ti < tierDefs.length; ti++) {
    const t = tierDefs[ti]!;

    const seatTex = makeSeatingTexture(ti);
    seatTex.repeat.set(t.tx, t.ty);
    toDispose.push(seatTex);

    // Inner seating surface
    const geo = new THREE.CylinderGeometry(t.rTop, t.rBot, t.h, 80, 1, true);
    toDispose.push(geo);
    const mat = new THREE.MeshStandardMaterial({
      map: seatTex,
      side: THREE.BackSide,
      roughness: 0.85,
      metalness: 0.0,
    });
    toDispose.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = t.yBot + t.h / 2;
    group.add(mesh);

    // Outer concrete shell
    const outGeo = new THREE.CylinderGeometry(t.rTop + 1.2, t.rBot + 1.2, t.h + 0.5, 80, 1, true);
    toDispose.push(outGeo);
    const outMat = new THREE.MeshStandardMaterial({ color: 0x0b160b, roughness: 0.95 });
    toDispose.push(outMat);
    const outMesh = new THREE.Mesh(outGeo, outMat);
    outMesh.position.y = t.yBot + t.h / 2;
    group.add(outMesh);

    // Concourse floor ring at the base of each tier
    const concGeo = new THREE.RingGeometry(t.rBot - 0.5, t.rBot + 3, 80);
    toDispose.push(concGeo);
    const concMat = new THREE.MeshStandardMaterial({ color: 0x141e14, roughness: 0.9 });
    toDispose.push(concMat);
    const conc = new THREE.Mesh(concGeo, concMat);
    conc.rotation.x = -Math.PI / 2;
    conc.position.y = t.yBot;
    group.add(conc);
  }

  // ─── Boundary advertising boards ───
  const NUM_BOARDS = 28;
  for (let i = 0; i < NUM_BOARDS; i++) {
    const angle = (i / NUM_BOARDS) * Math.PI * 2;
    const r = 37.2;

    const adTex = makeAdBoardTexture(i);
    toDispose.push(adTex);

    const bGeo = new THREE.PlaneGeometry(8.2, 2.2);
    toDispose.push(bGeo);
    const bMat = new THREE.MeshBasicMaterial({ map: adTex, side: THREE.DoubleSide });
    toDispose.push(bMat);

    const board = new THREE.Mesh(bGeo, bMat);
    board.position.set(Math.sin(angle) * r, 1.1, Math.cos(angle) * r);
    board.rotation.y = angle;
    group.add(board);
  }

  // ─── Roof canopy ring over upper tier ───
  {
    const canopyGeo = new THREE.RingGeometry(64, 81, 80);
    toDispose.push(canopyGeo);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x09120a,
      roughness: 0.92,
      side: THREE.DoubleSide,
    });
    toDispose.push(canopyMat);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.rotation.x = -Math.PI / 2;
    canopy.position.y = 36.8;
    group.add(canopy);

    // Soffit glow (slightly warm, looks like underside lighting)
    const soffitGeo = new THREE.RingGeometry(63, 80, 80);
    toDispose.push(soffitGeo);
    const soffitMat = new THREE.MeshBasicMaterial({
      color: 0x3a5040,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide,
    });
    toDispose.push(soffitMat);
    const soffit = new THREE.Mesh(soffitGeo, soffitMat);
    soffit.rotation.x = Math.PI / 2;
    soffit.position.y = 36.7;
    group.add(soffit);
  }

  // ─── Floodlight masts (4 corners) ───
  const MAST_ANGLES = [45, 135, 225, 315].map(d => d * Math.PI / 180);
  const MAST_R = 72;
  const MAST_H = 35;

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a9e88, roughness: 0.45, metalness: 0.65 });
  toDispose.push(poleMat);

  for (let m = 0; m < 4; m++) {
    const ang = MAST_ANGLES[m]!;
    const mx = Math.sin(ang) * MAST_R;
    const mz = Math.cos(ang) * MAST_R;

    // Tapered pole
    const poleGeo = new THREE.CylinderGeometry(0.22, 0.5, MAST_H, 8);
    toDispose.push(poleGeo);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(mx, MAST_H / 2, mz);
    group.add(pole);

    // Cross-arm bar pointing tangentially across the field
    const barGeo = new THREE.BoxGeometry(6.5, 0.3, 0.3);
    toDispose.push(barGeo);
    const bar = new THREE.Mesh(barGeo, poleMat);
    bar.position.set(mx, MAST_H + 0.15, mz);
    // Rotate bar to be perpendicular to the mast radius (tangential)
    bar.rotation.y = ang;
    group.add(bar);

    // Three light banks per mast
    const bankOffsets = [-2.2, 0, 2.2];
    for (let li = 0; li < 3; li++) {
      const offs = bankOffsets[li]!;
      // Tangential offset: perpendicular to the radial direction
      const bx = mx + offs * Math.cos(ang);
      const bz = mz - offs * Math.sin(ang);

      const bankGeo = new THREE.BoxGeometry(0.9, 0.3, 0.65);
      toDispose.push(bankGeo);
      const bankMat = new THREE.MeshStandardMaterial({
        color: 0xfff8e0,
        emissive: 0xffffcc,
        emissiveIntensity: 1.4,
        roughness: 0.15,
        metalness: 0.35,
      });
      toDispose.push(bankMat);
      const bank = new THREE.Mesh(bankGeo, bankMat);
      bank.position.set(bx, MAST_H + 0.15, bz);
      group.add(bank);

      // SpotLight: no shadow for performance
      const spot = new THREE.SpotLight(0xfff8e0, 1.6, 150, Math.PI * 0.24, 0.5, 1.3);
      spot.position.set(bx, MAST_H + 0.8, bz);
      spot.target.position.set(0, 0, 0);
      spot.castShadow = false;
      floodlightLights.push(spot);
    }
  }

  return {
    group,
    floodlightLights,
    dispose: () => {
      for (const d of toDispose) d.dispose();
      for (const s of floodlightLights) s.dispose();
    },
  };
}
