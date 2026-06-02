import type { BoneAccumulator } from './BoneAccumulator.js';

export interface TestPhase {
  name:      string;
  bone:      string;
  axis:      'x' | 'y' | 'z';
  amplitude: number;
  lookFor:   string;
}

export const TEST_PHASES: TestPhase[] = [
  { name: 'RIGHT ARM',   bone: 'rightArm',  axis: 'x', amplitude: 0.5, lookFor: 'shoulder attached, mesh deforms cleanly' },
  { name: 'LEFT ARM',    bone: 'leftArm',   axis: 'x', amplitude: 0.5, lookFor: 'mirror of right arm, no tearing' },
  { name: 'SPINE TWIST', bone: 'spine',     axis: 'z', amplitude: 0.2, lookFor: 'torso bends, head follows, legs planted' },
  { name: 'HIP ROTATE',  bone: 'hips',      axis: 'y', amplitude: 0.3, lookFor: 'full-body twist, feet stay attached' },
  { name: 'KNEE LIFT',   bone: 'leftUpLeg', axis: 'x', amplitude: 0.5, lookFor: 'leg chain intact, knee bends naturally' },
  { name: 'HEAD TURN',   bone: 'head',      axis: 'y', amplitude: 0.5, lookFor: 'head rotates independently from spine' },
];

export class CapabilityTestController {
  private _elapsed = 0;
  readonly phaseDuration = 2.5;

  get phaseIndex():    number    { return Math.floor(this._elapsed / this.phaseDuration) % TEST_PHASES.length; }
  get phaseProgress(): number    { return (this._elapsed % this.phaseDuration) / this.phaseDuration; }
  get currentPhase():  TestPhase { return TEST_PHASES[this.phaseIndex]; }

  update(dt: number, acc: BoneAccumulator): void {
    this._elapsed += dt;
    const ph    = this.currentPhase;
    const angle = Math.sin(this.phaseProgress * Math.PI * 2) * ph.amplitude;
    if      (ph.axis === 'x') acc.addRot(ph.bone, angle, 0,     0);
    else if (ph.axis === 'y') acc.addRot(ph.bone, 0,     angle, 0);
    else                       acc.addRot(ph.bone, 0,     0,     angle);
  }
}
