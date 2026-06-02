/**
 * AnimationFX — frame-perfect sync-event bundles.
 *
 * Listens to snapshot.syncEvents.{ballReleaseId, ballContactId}. When a counter
 * diff is detected (engine FSM entered RELEASE / CONTACT this frame), fires
 * the full bundle synchronously on the same render frame.
 *
 * Active effects (bat vibration, body recoil) have their own decay timers
 * ticked each frame and contribute bone deltas via the BoneAccumulator.
 *
 * The bus does NOT trigger camera shake directly — it returns a `cameraImpulse`
 * value the renderer can fold into its existing impactJuice / camera offset
 * pipeline. Keeps coupling shallow.
 */

import * as THREE from 'three';
import type { EngineSnapshot } from '../../engine/GameEngine.js';
import type { BoneAccumulator } from './BoneAccumulator.js';

interface DecayEffect {
  /** Seconds since the effect fired. */
  t: number;
  /** Total duration in seconds. */
  dur: number;
}

export interface FxFrameOutput {
  /** Extra camera shake intensity contributed this frame (added to existing). */
  cameraShake: number;
  /** Z-impulse on camera (small punch-in at release). */
  cameraImpulse: number;
  /** Hit-flash overlay intensity 0..1 (renderer applies as CSS or shader). */
  flash: number;
  /** Bat-vibration rotation around the bat's long axis (radians). */
  batVibration: number;
}

export class AnimationFX {
  private _lastReleaseId = -1;
  private _lastContactId = -1;

  // Active decay effects
  private _bodyRecoil:  DecayEffect | null = null;
  private _batVibrate:  DecayEffect | null = null;
  private _flash:       DecayEffect | null = null;
  private _camImpulse:  DecayEffect | null = null;

  /** Last release event for trail/audio cues (consumed by renderer once). */
  pendingRelease: { bowlerType: string | undefined } | null = null;
  /** Last contact event for spark/audio cues. */
  pendingContact: { quality: string } | null = null;

  /** Consume sync events from the snapshot — call once per frame BEFORE controllers. */
  consume(snap: EngineSnapshot, dt: number): void {
    const ev = snap.syncEvents;

    if (ev.ballReleaseId !== this._lastReleaseId) {
      this._lastReleaseId = ev.ballReleaseId;
      if (this._lastReleaseId > 0) this._fireReleaseBundle(snap);
    }
    if (ev.ballContactId !== this._lastContactId) {
      this._lastContactId = ev.ballContactId;
      if (this._lastContactId > 0) this._fireContactBundle(snap);
    }

    this._tickEffects(dt);
  }

  /**
   * Compute the per-frame FX contributions (camera shake, flash, bat vibration).
   * Renderer reads this after consume().
   */
  frameOutput(): FxFrameOutput {
    const recoilDecay = this._normDecay(this._bodyRecoil);
    void recoilDecay;  // recoil is applied via contributeBoneDeltas; doesn't emit camera

    const camImpT = this._normDecay(this._camImpulse);
    const flashT  = this._normDecay(this._flash);
    const batT    = this._normDecay(this._batVibrate);

    const cameraImpulse = camImpT > 0 ? Math.sin(camImpT * Math.PI) * 0.015 : 0;
    // V6: 2x camera shake so contact impact reads at gameplay distance
    const cameraShake   = this._bodyRecoil ? (1 - this._normProgress(this._bodyRecoil)) * 0.080 : 0;
    // Flash ramps up fast then decays
    const flash         = flashT > 0
      ? (flashT < 0.25 ? flashT / 0.25 : 1 - (flashT - 0.25) / 0.75)
      : 0;
    // V6: stronger bat vibration (0.18→0.30) for readable bat-whip
    let batVibration = 0;
    if (this._batVibrate && batT > 0) {
      const decay = 1 - this._normProgress(this._batVibrate);
      batVibration = Math.sin(this._batVibrate.t * 80) * 0.30 * decay;
    }

    return { cameraShake, cameraImpulse, flash, batVibration };
  }

  /** Add bone deltas for body recoil into the batsman accumulator. */
  contributeBoneDeltas(acc: BoneAccumulator): void {
    if (this._bodyRecoil) {
      // V6 readability: 1.5-2x stronger body recoil so impact reads at
      // gameplay camera distance — spine compress, shoulder absorb, bat push
      const raw = 1 - this._normProgress(this._bodyRecoil);
      const d = raw * raw;
      acc.addRot('spine',       0.28 * d, 0.16 * d, 0.12 * d);
      acc.addRot('chest',       0.16 * d, 0.10 * d, 0.06 * d);
      acc.addRot('neck',        0.18 * d, 0, 0);
      acc.addRot('rightShoulder', 0, 0, 0.22 * d);
      acc.addRot('leftShoulder',  0, 0, -0.12 * d);
      acc.addRot('rightArm',   -0.30 * d, 0, 0.26 * d);
      acc.addRot('rightHand',   0.40 * d, 0, 0.18 * d);
      acc.addRot('leftArm',    -0.14 * d, 0, 0.12 * d);
      acc.addRot('head',        0.26 * d, 0, 0.10 * d);
    }
  }

  // ── Bundles ──────────────────────────────────────────────────────────────

  private _fireReleaseBundle(snap: EngineSnapshot): void {
    this._camImpulse = { t: 0, dur: 0.40 };
    this.pendingRelease = { bowlerType: snap.bowler.bowlerType };
  }

  private _fireContactBundle(snap: EngineSnapshot): void {
    // V6 readability: amplify all contact FX 1.5-2x so impact reads at
    // gameplay camera distance — body recoil, vibration, flash all bigger
    this._bodyRecoil = { t: 0, dur: 0.18 };  // 150→180ms — linger for readability
    this._batVibrate = { t: 0, dur: 0.14 };  // 100→140ms
    this._flash      = { t: 0, dur: 0.18 };  // 140→180ms
    this.pendingContact = { quality: snap.feedback.hitQuality ?? 'good' };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private _tickEffects(dt: number): void {
    const arr: (keyof this)[] = ['_bodyRecoil', '_batVibrate', '_flash', '_camImpulse'] as never;
    for (const key of arr) {
      const eff = (this as unknown as Record<string, DecayEffect | null>)[key as string];
      if (!eff) continue;
      eff.t += dt;
      if (eff.t >= eff.dur) (this as unknown as Record<string, DecayEffect | null>)[key as string] = null;
    }
  }

  private _normDecay(eff: DecayEffect | null): number {
    if (!eff) return 0;
    return eff.t;
  }

  private _normProgress(eff: DecayEffect): number {
    return Math.min(1, eff.t / eff.dur);
  }
}

/** Quaternion offset for bat vibration around bat's long axis (local +Y).
 *  Renderer multiplies the bat's world quaternion by this after sync. */
export function batVibrationQuat(amount: number, out?: THREE.Quaternion): THREE.Quaternion {
  const q = out ?? new THREE.Quaternion();
  return q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), amount);
}
