import * as THREE from 'three';
import type { CharacterInstance } from './CharacterManager.js';

// ── Animation state enum ──────────────────────────────────────────────────────

export type AnimState =
  | 'IDLE'
  | 'PREPARE'
  | 'BAT_SWING'
  | 'BAT_MISS'
  | 'BAT_SMALL_HIT'
  | 'BAT_BIG_HIT'
  | 'BAT_HUGE_HIT'
  | 'BOWL'
  | 'FOLLOW_THROUGH'
  | 'RUN'
  | 'CATCH'
  | 'DIVE'
  | 'CELEBRATE'
  | 'ANGRY'
  | 'INSURANCE';

// ── Pose type: canonical bone → Euler rotation ────────────────────────────────

type PoseMap = Partial<Record<string, THREE.Euler>>;

const E = (x: number, y: number, z: number) => new THREE.Euler(x, y, z);

// ── Pose library ──────────────────────────────────────────────────────────────

const POSES: Record<AnimState, PoseMap> = {
  IDLE: {
    spine:        E(0.06, 0, 0),
    chest:        E(0.04, 0, 0),
    rightArm:     E(0.12, 0, -0.22),
    leftArm:      E(0.12, 0, 0.22),
    rightForeArm: E(0.18, 0, 0),
    leftForeArm:  E(0.18, 0, 0),
    leftUpLeg:    E(-0.04, 0, 0.04),
    rightUpLeg:   E(-0.04, 0, -0.04),
  },

  // Cricket ready stance: knees bent, bat raised to chest height
  PREPARE: {
    hips:          E(-0.07, 0, 0),
    spine:         E(0.12, 0, 0),
    chest:         E(0.07, 0, 0),
    rightShoulder: E(0.05, 0, 0),
    rightArm:      E(-0.32, 0, -0.58),
    rightForeArm:  E(0.58, 0, -0.22),
    rightHand:     E(0.06, 0, -0.14),
    leftShoulder:  E(0.05, 0, 0),
    leftArm:       E(-0.28, 0, 0.68),
    leftForeArm:   E(0.52, 0, 0.18),
    leftHand:      E(0.06, 0, 0.11),
    leftUpLeg:     E(-0.20, 0, 0.08),
    rightUpLeg:    E(-0.20, 0, -0.08),
    leftLeg:       E(0.16, 0, 0),
    rightLeg:      E(0.16, 0, 0),
  },

  BAT_SWING: {
    hips:          E(0, 0.4, 0),
    spine:         E(0.1, 0.55, 0),
    chest:         E(0.05, 0.35, 0),
    rightShoulder: E(0.1, 0, 0),
    rightArm:      E(-0.7, 0, -1.3),
    rightForeArm:  E(0.2, 0, -0.6),
    rightHand:     E(0, 0, -0.4),
    leftShoulder:  E(0.1, 0, 0),
    leftArm:       E(-0.5, 0, 1.1),
    leftForeArm:   E(0.3, 0, 0.5),
    leftHand:      E(0, 0, 0.3),
  },

  BAT_MISS: {
    hips:          E(0, 0.2, 0),
    spine:         E(0.15, 0.2, 0),
    head:          E(-0.1, -0.15, 0),
    rightArm:      E(-0.3, 0, -0.9),
    rightForeArm:  E(0.4, 0, -0.3),
    leftArm:       E(-0.2, 0, 0.7),
  },

  BAT_SMALL_HIT: {
    hips:          E(0, 0.25, 0),
    spine:         E(0.08, 0.3, 0),
    chest:         E(0.04, 0.2, 0),
    rightArm:      E(-0.4, 0, -1.1),
    rightForeArm:  E(0.2, 0, -0.4),
    leftArm:       E(-0.3, 0, 0.9),
    leftForeArm:   E(0.15, 0, 0.3),
    head:          E(0.05, 0.15, 0),
  },

  BAT_BIG_HIT: {
    hips:          E(0, 0.6, 0),
    spine:         E(0.1, 0.7, 0),
    chest:         E(0.06, 0.45, 0),
    rightShoulder: E(0.15, 0, 0),
    rightArm:      E(-0.9, 0, -1.6),
    rightForeArm:  E(0.1, 0, -0.7),
    rightHand:     E(0, 0, -0.5),
    leftShoulder:  E(0.15, 0, 0),
    leftArm:       E(-0.7, 0, 1.4),
    leftForeArm:   E(0.1, 0, 0.6),
    leftHand:      E(0, 0, 0.4),
    head:          E(0.1, 0.25, 0),
  },

  BAT_HUGE_HIT: {
    hips:          E(-0.1, 0.8, 0),
    spine:         E(0.12, 0.9, 0),
    chest:         E(0.08, 0.6, 0),
    rightShoulder: E(0.2, 0, 0),
    rightArm:      E(-1.2, 0, -1.8),
    rightForeArm:  E(0.05, 0, -0.8),
    rightHand:     E(0, 0, -0.6),
    leftShoulder:  E(0.2, 0, 0),
    leftArm:       E(-1.0, 0, 1.7),
    leftForeArm:   E(0.05, 0, 0.7),
    leftHand:      E(0, 0, 0.5),
    head:          E(0.15, 0.4, 0),
    leftUpLeg:     E(-0.08, 0, 0.05),
    rightUpLeg:    E(-0.12, 0, -0.05),
  },

  BOWL: {
    hips:          E(0, -0.3, 0),
    spine:         E(0.2, -0.2, 0),
    chest:         E(0.15, -0.1, 0),
    rightArm:      E(-1.4, 0, -0.5),
    rightForeArm:  E(-0.2, 0, 0),
    rightHand:     E(-0.1, 0, 0),
    leftArm:       E(0.6, 0, 0.8),
    leftForeArm:   E(0.5, 0, 0),
    leftUpLeg:     E(-0.6, 0, 0.1),
    rightUpLeg:    E(0.4, 0, -0.1),
    rightLeg:      E(0.5, 0, 0),
    leftLeg:       E(-0.2, 0, 0),
  },

  // Bowler arm/body follow-through after release
  FOLLOW_THROUGH: {
    hips:          E(0, 0.50, 0),
    spine:         E(0.20, 0.30, 0),
    chest:         E(0.14, 0.20, 0),
    rightArm:      E(-0.85, 0, -0.30),
    rightForeArm:  E(0.30, 0, -0.10),
    rightHand:     E(0, 0, 0),
    leftArm:       E(0.50, 0, 0.55),
    leftForeArm:   E(0.40, 0, 0),
    head:          E(0.12, 0.25, 0),
    leftUpLeg:     E(-0.60, 0, 0.08),
    rightUpLeg:    E(0.38, 0, -0.08),
    rightLeg:      E(0.38, 0, 0),
    leftLeg:       E(-0.12, 0, 0),
  },

  RUN: {
    hips:          E(0.08, 0, 0),
    spine:         E(0.12, 0, 0),
    rightArm:      E(-0.6, 0, -0.15),
    rightForeArm:  E(0.7, 0, 0),
    leftArm:       E(0.6, 0, 0.15),
    leftForeArm:   E(-0.7, 0, 0),
    leftUpLeg:     E(-0.8, 0, 0.05),
    leftLeg:       E(0.9, 0, 0),
    rightUpLeg:    E(0.7, 0, -0.05),
    rightLeg:      E(-0.5, 0, 0),
  },

  CATCH: {
    hips:          E(0.05, 0, 0),
    spine:         E(0.1, 0, 0),
    rightArm:      E(-1.3, 0, -0.2),
    rightForeArm:  E(-0.4, 0, 0),
    rightHand:     E(0.2, 0, 0),
    leftArm:       E(-1.3, 0, 0.2),
    leftForeArm:   E(-0.4, 0, 0),
    leftHand:      E(0.2, 0, 0),
    head:          E(-0.2, 0, 0),
  },

  DIVE: {
    hips:          E(0.3, 0, 0.4),
    spine:         E(0.35, 0, 0.2),
    chest:         E(0.25, 0, 0.1),
    rightArm:      E(-0.9, 0, -0.6),
    rightForeArm:  E(-0.3, 0, 0),
    leftArm:       E(-0.9, 0, 0.6),
    leftForeArm:   E(-0.3, 0, 0),
    leftUpLeg:     E(-0.4, 0, 0.1),
    rightUpLeg:    E(0.6, 0, -0.1),
    leftLeg:       E(-0.3, 0, 0),
    rightLeg:      E(-0.5, 0, 0),
  },

  CELEBRATE: {
    hips:          E(-0.1, 0, 0),
    spine:         E(-0.12, 0, 0),
    chest:         E(-0.08, 0, 0),
    rightArm:      E(-1.6, 0, -0.4),
    rightForeArm:  E(-0.3, 0, 0),
    leftArm:       E(-1.6, 0, 0.4),
    leftForeArm:   E(-0.3, 0, 0),
    head:          E(-0.15, 0, 0),
    leftUpLeg:     E(0.1, 0, 0.08),
    rightUpLeg:    E(0.1, 0, -0.08),
  },

  ANGRY: {
    hips:          E(0.05, 0, 0),
    spine:         E(0.18, 0, 0),
    chest:         E(0.12, 0, 0),
    rightArm:      E(0.4, 0, -0.5),
    rightForeArm:  E(0.6, 0, -0.3),
    rightHand:     E(0.2, 0, -0.2),
    leftArm:       E(0.4, 0, 0.5),
    leftForeArm:   E(0.6, 0, 0.3),
    leftHand:      E(0.2, 0, 0.2),
    head:          E(0.1, 0, 0),
  },

  INSURANCE: {
    hips:          E(0, 0, 0),
    spine:         E(-0.05, 0, 0),
    rightArm:      E(-0.3, 0, -1.5),
    rightForeArm:  E(0, 0, 0),
    leftArm:       E(-0.3, 0, 1.5),
    leftForeArm:   E(0, 0, 0),
    head:          E(-0.08, 0, 0),
  },
};

// ── AnimationManager ─────────────────────────────────────────────────────────

const _targetQ = new THREE.Quaternion();
const _euler   = new THREE.Euler();

export class AnimationManager {
  private _char:          CharacterInstance | null = null;
  private _state:         AnimState = 'IDLE';
  private _blendTime     = 0;
  private _blendDuration = 0.25;
  private _time          = 0;
  private _stateTime     = 0;   // seconds since last setState()
  private _speedScale    = 1.0;

  // ── One-shot queue: after a reaction hold, auto-transition ────────────────
  private _queuedState:    AnimState | null = null;
  private _queueTimer      = 0;
  private _queueBlend      = 0.35;

  // Mixer action for baked clips
  private _mixerAction: THREE.AnimationAction | null = null;

  setSpeedScale(scale: number): void { this._speedScale = scale; }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  attach(char: CharacterInstance): void {
    this._char     = char;
    this._time     = 0;
    this._stateTime = 0;
    this._state    = 'IDLE';
    this._queuedState = null;

    const idleClip = char.clips.find(c => /idle/i.test(c.name) || /stand/i.test(c.name));
    if (idleClip) {
      this._mixerAction = char.mixer.clipAction(idleClip);
      this._mixerAction.play();
    }
  }

  detach(): void {
    this._mixerAction?.stop();
    this._mixerAction = null;
    this._char        = null;
    this._queuedState = null;
  }

  // ── State control ─────────────────────────────────────────────────────────

  /**
   * Transition to a new state.
   * Does NOT clear a queued transition — use clearQueue() first when breaking
   * out of a reaction sequence early (e.g. celebrate overrides a hit-sequence).
   */
  setState(state: AnimState, blendDuration = 0.25): void {
    if (this._state === state) return;
    this._state        = state;
    this._blendTime    = 0;
    this._blendDuration = blendDuration;
    this._stateTime    = 0;

    if (!this._char) return;

    const clipName = state.toLowerCase().replace(/_/g, '-');
    const clip = this._char.clips.find(c => c.name.toLowerCase().includes(clipName));

    if (clip) {
      // Found a matching baked clip — blend into it
      this._mixerAction?.fadeOut(blendDuration);
      this._mixerAction = this._char.mixer.clipAction(clip);
      this._mixerAction.reset().fadeIn(blendDuration).play();
    } else {
      // No matching clip — fade out baked action so procedural takes over
      this._mixerAction?.fadeOut(blendDuration);
      this._mixerAction = null;

      // Re-attach idle baked clip when returning to IDLE
      if (state === 'IDLE') {
        const idleClip = this._char.clips.find(c =>
          /idle/i.test(c.name) || /stand/i.test(c.name),
        );
        if (idleClip) {
          this._mixerAction = this._char.mixer.clipAction(idleClip);
          this._mixerAction.reset().fadeIn(blendDuration).play();
        }
      }
    }
  }

  /** Queue an automatic transition to fire after `delay` seconds. */
  queueStateAfter(state: AnimState, delay: number, blendDuration = 0.35): void {
    this._queuedState = state;
    this._queueTimer  = delay;
    this._queueBlend  = blendDuration;
  }

  /** Cancel any pending queued transition. */
  clearQueue(): void {
    this._queuedState = null;
    this._queueTimer  = 0;
  }

  getState(): AnimState { return this._state; }

  // ── Per-frame update ───────────────────────────────────────────────────────

  update(dt: number): void {
    if (!this._char) return;

    const scaledDt = dt * this._speedScale;
    this._time     += scaledDt;
    this._stateTime += scaledDt;
    this._blendTime  = Math.min(this._blendTime + dt, this._blendDuration);

    // Tick queued transition
    if (this._queuedState !== null) {
      this._queueTimer -= dt;
      if (this._queueTimer <= 0) {
        const next = this._queuedState;
        const blend = this._queueBlend;
        this._queuedState = null;
        this.setState(next, blend);
      }
    }

    this._char.mixer.update(scaledDt);
    this._applyProceduralPose(this._blendDuration > 0 ? this._blendTime / this._blendDuration : 1);
  }

  // ── Procedural pose application ────────────────────────────────────────────

  private _applyProceduralPose(blend: number): void {
    if (!this._char) return;
    const t = this._time;

    // If a baked clip is driving this state (matched by name), only add secondary motion
    if (this._mixerAction?.isRunning() && this._state !== 'IDLE') {
      this._applyBreathing(t, blend * 0.25);
      return;
    }

    // Full procedural drive — apply pose targets
    const pose = POSES[this._state];
    for (const [canonical, euler] of Object.entries(pose)) {
      const bone = this._char.bones.get(canonical);
      if (!bone || !euler) continue;
      _euler.copy(euler);
      _targetQ.setFromEuler(_euler);
      bone.quaternion.slerp(_targetQ, blend);
    }

    // State-specific secondary motion
    this._applyBreathing(t, blend);

    if (this._state === 'RUN') {
      this._applyRunCycle(t);
    }
    if (this._state === 'CELEBRATE') {
      this._applyCelebration(t);
    }
    if (this._state === 'BAT_MISS') {
      this._applyHeadShake();
    }
    if (this._state === 'PREPARE') {
      this._applyPrepareSway(t);
    }
  }

  // ── Secondary motions ──────────────────────────────────────────────────────

  private _applyBreathing(t: number, weight: number): void {
    if (!this._char) return;
    const freq   = 1.4 * this._speedScale;
    const breath = Math.sin(t * freq) * 0.012 * weight;
    const sway   = Math.sin(t * (0.85 * this._speedScale) + 0.3) * 0.008 * weight;

    const chest = this._char.bones.get('chest');
    if (chest) { chest.rotation.x += breath; chest.rotation.z += sway; }
    const spine = this._char.bones.get('spine');
    if (spine) spine.rotation.x += breath * 0.5;
  }

  private _applyRunCycle(t: number): void {
    if (!this._char) return;
    const phase = t * 6.0 * this._speedScale;
    const swing = Math.sin(phase) * 0.55;

    const ll = this._char.bones.get('leftUpLeg');
    const rl = this._char.bones.get('rightUpLeg');
    const lk = this._char.bones.get('leftLeg');
    const rk = this._char.bones.get('rightLeg');
    const la = this._char.bones.get('leftArm');
    const ra = this._char.bones.get('rightArm');

    if (ll) ll.rotation.x = -swing;
    if (rl) rl.rotation.x = swing;
    if (lk) lk.rotation.x = Math.max(0, swing) * 0.6;
    if (rk) rk.rotation.x = Math.max(0, -swing) * 0.6;
    if (la) la.rotation.x = swing * 0.55;
    if (ra) ra.rotation.x = -swing * 0.55;
  }

  private _applyCelebration(t: number): void {
    if (!this._char) return;
    const jump = Math.abs(Math.sin(t * 3.5)) * 0.08;
    const wave = Math.sin(t * 4.0) * 0.25;

    const hips = this._char.bones.get('hips');
    if (hips) hips.position.y = (hips.position.y || 0) * 0.9 + jump;

    const ra = this._char.bones.get('rightArm');
    const la = this._char.bones.get('leftArm');
    if (ra) ra.rotation.z = -1.4 + wave;
    if (la) la.rotation.z = 1.4 - wave;
  }

  // Decaying head-shake oscillation on miss (reads stateTime so it fades out naturally)
  private _applyHeadShake(): void {
    if (!this._char) return;
    const head = this._char.bones.get('head');
    if (!head) return;
    const amp = Math.max(0, 0.22 * Math.exp(-this._stateTime * 2.8));
    head.rotation.y += Math.sin(this._stateTime * 18) * amp;
  }

  // Subtle weight-shift bob while in cricket guard stance
  private _applyPrepareSway(t: number): void {
    if (!this._char) return;
    const sway = Math.sin(t * 2.2) * 0.018;
    const bob  = Math.abs(Math.sin(t * 1.7)) * 0.012;

    const hips = this._char.bones.get('hips');
    if (hips) {
      hips.rotation.z += sway;
      hips.position.y -= bob;
    }
  }
}
