let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function resume(): AudioContext | null {
  const c = getCtx();
  if (c?.state === 'suspended') void c.resume();
  return c;
}

/** UI blip */
export function playBlip(freq: number, duration = 0.06, gain = 0.08): void {
  const c = resume();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + duration);
}

/** Quick button click — snappy transient */
export function playClick(): void {
  const c = resume();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(600, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(280, c.currentTime + 0.04);
  g.gain.setValueAtTime(0.1, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.06);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.07);
}

/** Bet confirmed — satisfying two-tone chime */
export function playBetConfirm(): void {
  const c = resume();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = 0.12;
  master.connect(c.destination);
  [440, 660].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    const t = c.currentTime + i * 0.07;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.28);
  });
}

/** Bat contact */
export function playCrack(): void {
  const c = resume();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = 1050 + Math.random() * 150;
  g.gain.setValueAtTime(0.12, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.055);
}

/** Wicket — triangle thud + square ping + noise burst */
export function playWicketClatter(): void {
  const c = resume();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = 0.35;
  master.connect(c.destination);

  const tri = c.createOscillator();
  const triG = c.createGain();
  tri.type = 'triangle';
  tri.frequency.value = 180;
  triG.gain.setValueAtTime(0.2, c.currentTime);
  triG.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
  tri.connect(triG); triG.connect(master);
  tri.start(); tri.stop(c.currentTime + 0.26);

  const sq = c.createOscillator();
  const sqG = c.createGain();
  sq.type = 'square';
  sq.frequency.value = 620;
  sqG.gain.setValueAtTime(0.08, c.currentTime + 0.02);
  sqG.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
  sq.connect(sqG); sqG.connect(master);
  sq.start(c.currentTime + 0.02); sq.stop(c.currentTime + 0.1);

  const noiseLen = 0.14;
  const noiseBuf = c.createBuffer(1, c.sampleRate * noiseLen, c.sampleRate);
  const ch = noiseBuf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const noise = c.createBufferSource();
  noise.buffer = noiseBuf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 900;
  const nG = c.createGain();
  nG.gain.setValueAtTime(0.15, c.currentTime);
  nG.gain.exponentialRampToValueAtTime(0.001, c.currentTime + noiseLen);
  noise.connect(bp); bp.connect(nG); nG.connect(master);
  noise.start(); noise.stop(c.currentTime + noiseLen);
}

/** Crowd swell */
export function playCrowdSwell(intensity: 'boundary' | 'mild'): void {
  const c = resume();
  if (!c) return;
  const dur = intensity === 'boundary' ? 0.45 : 0.2;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = intensity === 'boundary' ? 2800 : 1200;
  const g = c.createGain();
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(intensity === 'boundary' ? 0.12 : 0.06, c.currentTime + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  src.connect(lp); lp.connect(g); g.connect(c.destination);
  src.start(); src.stop(c.currentTime + dur);
}

/** Soft groan on wicket */
export function playCrowdGroan(): void {
  const c = resume();
  if (!c) return;
  const dur = 0.35;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(400, c.currentTime);
  lp.frequency.linearRampToValueAtTime(180, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.08, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  src.connect(lp); lp.connect(g); g.connect(c.destination);
  src.start(); src.stop(c.currentTime + dur);
}

/** Multiplier tick — pitch rises with multiplier */
export function playTick(multiplier: number): void {
  const c = resume();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = 800 + Math.min(2200, multiplier * 45);
  g.gain.setValueAtTime(0.045, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.035);
  o.connect(g); g.connect(c.destination);
  o.start(); o.stop(c.currentTime + 0.04);
}

/**
 * Milestone fanfare — different flavour per tier.
 * tier 1 = 2x (bright ping), tier 2 = 5x (arpeggio), tier 3 = 10x+ (full chord burst)
 */
export function playMilestone(tier: 1 | 2 | 3): void {
  const c = resume();
  if (!c) return;
  const master = c.createGain();
  master.connect(c.destination);

  if (tier === 1) {
    // Single bright ping
    master.gain.value = 0.14;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, c.currentTime + 0.12);
    g.gain.setValueAtTime(0.1, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    o.connect(g); g.connect(master);
    o.start(); o.stop(c.currentTime + 0.45);
  } else if (tier === 2) {
    // Rising arpeggio
    master.gain.value = 0.12;
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const t = c.currentTime + i * 0.08;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.4);
    });
  } else {
    // Full chord burst
    master.gain.value = 0.16;
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = i % 2 === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      const t = c.currentTime + i * 0.04;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.1, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.8);
    });
    // Add a low sub thud
    const sub = c.createOscillator();
    const subG = c.createGain();
    sub.type = 'sine';
    sub.frequency.value = 65;
    subG.gain.setValueAtTime(0.2, c.currentTime);
    subG.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
    sub.connect(subG); subG.connect(master);
    sub.start(); sub.stop(c.currentTime + 0.28);
  }
}

/** Tension Hum — looping oscillator with harmonics */
let tensionNode: { osc: OscillatorNode; gain: GainNode; osc2: OscillatorNode } | null = null;

export function startTensionHum(): void {
  const c = resume();
  if (!c || tensionNode) return;

  const osc = c.createOscillator();
  const osc2 = c.createOscillator();
  const gain = c.createGain();

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 350;

  osc.type = 'sawtooth';
  osc.frequency.value = 60;

  // Harmonic overtone — adds depth
  osc2.type = 'sine';
  osc2.frequency.value = 120;

  const gain2 = c.createGain();
  gain2.gain.value = 0.3;

  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.07, c.currentTime + 1.5);

  osc.connect(lp);
  osc2.connect(gain2);
  gain2.connect(lp);
  lp.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc2.start();
  tensionNode = { osc, gain, osc2 };
}

export function updateTensionPitch(multiplier: number): void {
  if (!tensionNode) return;
  const c = getCtx();
  if (!c) return;
  tensionNode.osc.frequency.setTargetAtTime(60 + multiplier * 5, c.currentTime, 0.1);
  tensionNode.osc2.frequency.setTargetAtTime(120 + multiplier * 10, c.currentTime, 0.1);
  // Volume also creeps up slightly
  const targetGain = Math.min(0.12, 0.07 + multiplier * 0.005);
  tensionNode.gain.gain.setTargetAtTime(targetGain, c.currentTime, 0.5);
}

export function stopTensionHum(): void {
  if (!tensionNode) return;
  const c = getCtx();
  if (!c) return;
  const { osc, osc2, gain } = tensionNode;
  gain.gain.setTargetAtTime(0, c.currentTime, 0.2);
  setTimeout(() => {
    try { osc.stop(); osc2.stop(); } catch {}
  }, 350);
  tensionNode = null;
}

/** Cashout Win — bright harmonic chord */
export function playCashoutWin(): void {
  const c = resume();
  if (!c) return;
  const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];
  const master = c.createGain();
  master.gain.setValueAtTime(0.14, c.currentTime);
  master.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.4);
  master.connect(c.destination);

  freqs.forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = i % 2 === 0 ? 'sine' : 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(0.1, c.currentTime + 0.04 + i * 0.02);
    o.connect(g); g.connect(master);
    o.start(); o.stop(c.currentTime + 1.6);
  });

  // Sparkle high-freq sweep
  const sweep = c.createOscillator();
  const sweepG = c.createGain();
  sweep.type = 'sine';
  sweep.frequency.setValueAtTime(2000, c.currentTime);
  sweep.frequency.exponentialRampToValueAtTime(4000, c.currentTime + 0.3);
  sweepG.gain.setValueAtTime(0.06, c.currentTime);
  sweepG.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35);
  sweep.connect(sweepG); sweepG.connect(master);
  sweep.start(); sweep.stop(c.currentTime + 0.38);
}
