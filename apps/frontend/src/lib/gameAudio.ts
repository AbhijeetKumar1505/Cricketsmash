let ctx: AudioContext | null = null;
/** Single master bus — every synthesized voice routes here so mute is global. */
let masterGain: GainNode | null = null;
let _muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = _muted ? 0 : 1;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

function resume(): AudioContext | null {
  const c = getCtx();
  if (c?.state === 'suspended') void c.resume();
  return c;
}

/** Output bus for all synthesized voices (master gain if ready, else destination). */
function out(c: AudioContext): AudioNode {
  return masterGain ?? c.destination;
}

// ── Global mute + looping background music ──────────────────────────────────────
let bgAudio: HTMLAudioElement | null = null;

/** Mute/unmute ALL audio — synthesized SFX (via master gain) and background music. */
export function setMuted(muted: boolean): void {
  _muted = muted;
  if (masterGain && ctx) {
    masterGain.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.015);
  }
  if (bgAudio) bgAudio.muted = muted;
}

export function isMuted(): boolean {
  return _muted;
}

/** Start (or resume) the looping background track. Safe to call repeatedly. */
export function startBackgroundMusic(): void {
  if (typeof window === 'undefined') return;
  if (!bgAudio) {
    bgAudio = new Audio('/gameBGsound.mpeg');
    bgAudio.loop = true;
    bgAudio.volume = 0.25;
    bgAudio.muted = _muted;
  }
  // Autoplay may be blocked until a user gesture — ignore the rejection.
  void bgAudio.play().catch(() => {});
}

export function stopBackgroundMusic(): void {
  if (bgAudio) {
    bgAudio.pause();
    bgAudio.currentTime = 0;
  }
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
  g.connect(out(c));
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
  g.connect(out(c));
  o.start();
  o.stop(c.currentTime + 0.07);
}

/** Bet confirmed — satisfying two-tone chime */
export function playBetConfirm(): void {
  const c = resume();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = 0.12;
  master.connect(out(c));
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
  g.connect(out(c));
  o.start();
  o.stop(c.currentTime + 0.055);

  // Bass transient — low thump for physical impact feel
  const bass = c.createOscillator();
  const bassG = c.createGain();
  bass.type = 'sine';
  bass.frequency.setValueAtTime(180, c.currentTime);
  bass.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.08);
  bassG.gain.setValueAtTime(0.18, c.currentTime);
  bassG.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.10);
  bass.connect(bassG);
  bassG.connect(out(c));
  bass.start();
  bass.stop(c.currentTime + 0.12);
}

/** Wicket — triangle thud + square ping + noise burst */
export function playWicketClatter(): void {
  const c = resume();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = 0.35;
  master.connect(out(c));

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
  src.connect(lp); lp.connect(g); g.connect(out(c));
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
  src.connect(lp); lp.connect(g); g.connect(out(c));
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
  o.connect(g); g.connect(out(c));
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
  master.connect(out(c));

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
  gain.connect(out(c));
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
  master.connect(out(c));

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

// ─── Crowd Sound Design (Synthesized) ────────────────────────────────────────

let crowdMurmur: { src: AudioBufferSourceNode; gain: GainNode; lp: BiquadFilterNode } | null = null;

/** Start a continuous background crowd murmur (pink-ish noise) */
export function startCrowdMurmur(): void {
  const c = resume();
  if (!c || crowdMurmur) return;

  const bufSize = c.sampleRate * 2;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const d = buf.getChannelData(0);
  // Simple noise with brown-ish tilt
  let lastOut = 0;
  for (let i = 0; i < bufSize; i++) {
    const white = Math.random() * 2 - 1;
    const brown = (lastOut + (0.02 * white)) / 1.02;
    lastOut = brown;
    d[i] = brown * 3.5;
  }

  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 800; // Base muffled crowd
  lp.Q.value = 1.0;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.04, c.currentTime + 2.0);

  src.connect(lp);
  lp.connect(gain);
  gain.connect(out(c));

  src.start();
  crowdMurmur = { src, gain, lp };
}

/** Update crowd roar intensity and brightness (0-1) */
export function updateCrowdHype(level: number): void {
  if (!crowdMurmur) return;
  const c = getCtx();
  if (!c) return;

  const targetFreq = 800 + level * 2200;
  const targetGain = 0.04 + level * 0.08;

  crowdMurmur.lp.frequency.setTargetAtTime(targetFreq, c.currentTime, 0.4);
  crowdMurmur.gain.gain.setTargetAtTime(targetGain, c.currentTime, 0.4);
}

/** One-off reaction shout burst */
export function playCrowdShout(intensity: number): void {
  const c = resume();
  if (!c) return;

  const dur = 0.8 + intensity * 1.5;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1200 + intensity * 800;
  bp.Q.value = 0.8;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.12 * intensity, c.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);

  src.connect(bp); bp.connect(gain); gain.connect(out(c));
  src.start(); src.stop(c.currentTime + dur);
}


/** Victory Fanfare — triumphant multi-oscillator sequence */
export function playVictoryFanfare(): void {
  const c = resume();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = 0.2;
  master.connect(out(c));

  const notes = [
    { f: 523.25, t: 0.0 }, // C5
    { f: 659.25, t: 0.15 }, // E5
    { f: 783.99, t: 0.3 },  // G5
    { f: 1046.50, t: 0.45 }, // C6
  ];

  notes.forEach((n) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = n.f;
    const startTime = c.currentTime + n.t;
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
    o.connect(g); g.connect(master);
    o.start(startTime); o.stop(startTime + 0.65);
  });

  // Brass-like layer
  const brass = c.createOscillator();
  const brassG = c.createGain();
  brass.type = 'sawtooth';
  brass.frequency.value = 261.63; // C4
  const bStart = c.currentTime + 0.45;
  brassG.gain.setValueAtTime(0, bStart);
  brassG.gain.linearRampToValueAtTime(0.1, bStart + 0.1);
  brassG.gain.exponentialRampToValueAtTime(0.001, bStart + 1.2);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1200;
  brass.connect(lp); lp.connect(brassG); brassG.connect(master);
  brass.start(bStart); brass.stop(bStart + 1.3);
}

/** Broadcast Score Ticker sound */
export function playTickerUpdate(): void {
  const c = resume();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(1200, c.currentTime);
  o.frequency.linearRampToValueAtTime(1800, c.currentTime + 0.04);
  g.gain.setValueAtTime(0.05, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
  o.connect(g); g.connect(out(c));
  o.start(); o.stop(c.currentTime + 0.05);
}

/** Two-note bell chime played when a win toast appears. Big wins (≥3×) add a third note. */
export function playWinTrin(multiplier = 1): void {
  const c = resume();
  if (!c) return;
  const now = c.currentTime;
  const notes: Array<{ freq: number; delay: number; gain: number }> = [
    { freq: 1047, delay: 0,    gain: 0.28 },  // C6
    { freq: 1319, delay: 0.13, gain: 0.20 },  // E6
  ];
  if (multiplier >= 3) notes.push({ freq: 1568, delay: 0.26, gain: 0.16 }); // G6
  for (const n of notes) {
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = n.freq;
    g.gain.setValueAtTime(0, now + n.delay);
    g.gain.linearRampToValueAtTime(n.gain, now + n.delay + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + n.delay + 0.75);
    osc.connect(g);
    g.connect(out(c));
    osc.start(now + n.delay);
    osc.stop(now + n.delay + 0.76);
  }
}

