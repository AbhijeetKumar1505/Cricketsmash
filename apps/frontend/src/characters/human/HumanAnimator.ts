import * as THREE from 'three';
import type { HumanCharacter } from './HumanCharacter.js';
import type { SimPhase } from '../../engine/physics/ballTrajectory.js';

export type { CharacterRole } from './HumanBodyMesh.js';

export type AnimatorInput = {
  phase: SimPhase | 'idle' | 'bowl' | 'hit' | 'wicket' | 'celebrate';
  phaseProgress: number;
  bowlerType: string;
  shotType: string;
  dt: number;
  time: number;
  ballPos?: THREE.Vector3;
  stanceFocusWorld?: THREE.Vector3;
  isSwinging?: boolean;
  hitQuality?: string;
  controllerState?: 'Idle' | 'Ready' | 'React' | 'Execute' | 'Recover';
  controllerSubState?: string;
  presenceWeight?: number;
  /** 0–1 smoothed fielder “gather ball” athletic lean (FielderController). */
  fieldGatherBlend?: number;
};

export class AnimationStack {
  evaluate(_char: HumanCharacter, _input: AnimatorInput): void {}
}

export class IKLayer {}

export function getAnimationStack(_char: HumanCharacter): AnimationStack {
  return new AnimationStack();
}

export function setFootGroundingBlend(_weight: number): void {}
export function triggerBatContact(): void {}
export function clearBatContact(): void {}

function wave(time: number, phase: number, amp: number): number {
  return Math.sin(time * 1.7 + phase) * amp;
}

function applyNeutralPose(char: HumanCharacter, input: AnimatorInput, presence = 1): void {
  char.resetPose();
  const { bones } = char;
  const breathe = wave(input.time, char.idlePhase, 0.018) * presence;

  bones.chest.rotation.x = breathe * 0.35;
  bones.neck.rotation.x = breathe * 0.12;
  bones.head.rotation.z = wave(input.time, char.idlePhase + 1.4, 0.010) * presence;
  bones.upperArmL.rotation.z += 0.030 + wave(input.time, char.idlePhase + 0.2, 0.012) * presence;
  bones.upperArmR.rotation.z -= 0.030 + wave(input.time, char.idlePhase + 1.1, 0.012) * presence;
  bones.lowerArmL.rotation.z += 0.018 + wave(input.time, char.idlePhase + 0.8, 0.008) * presence;
  bones.lowerArmR.rotation.z -= 0.018 + wave(input.time, char.idlePhase + 1.8, 0.008) * presence;
  bones.lowerArmL.rotation.x += 0.030;
  bones.lowerArmR.rotation.x += 0.030;
  bones.thighL.rotation.x += wave(input.time, char.idlePhase + 0.4, 0.006) * presence;
  bones.thighR.rotation.x -= wave(input.time, char.idlePhase + 0.7, 0.006) * presence;
}

export function animateHumanBatsman(char: HumanCharacter, input: AnimatorInput): void {
  applyNeutralPose(char, input, 0.75);
  if (input.controllerState === 'Execute' || input.isSwinging) {
    const t = THREE.MathUtils.clamp(input.phaseProgress, 0, 1);
    char.bones.chest.rotation.y += THREE.MathUtils.lerp(-0.10, 0.24, t);
    char.bones.upperArmR.rotation.x -= THREE.MathUtils.lerp(0.10, 0.52, t);
    char.bones.lowerArmR.rotation.x -= THREE.MathUtils.lerp(0.06, 0.24, t);
    char.bones.upperArmL.rotation.x -= THREE.MathUtils.lerp(0.06, 0.22, t);
  }
}

export function animateHumanBowler(char: HumanCharacter, input: AnimatorInput): void {
  applyNeutralPose(char, input, 0.70);
  if (input.controllerState === 'Execute') {
    const t = THREE.MathUtils.clamp(input.phaseProgress, 0, 1);
    char.bones.chest.rotation.x += THREE.MathUtils.lerp(0.02, -0.14, t);
    char.bones.upperArmR.rotation.x -= THREE.MathUtils.lerp(0.12, 0.82, t);
    char.bones.lowerArmR.rotation.x -= THREE.MathUtils.lerp(0.04, 0.36, t);
    char.bones.upperArmL.rotation.x += THREE.MathUtils.lerp(0.04, 0.18, t);
  }
}

export function animateHumanFielder(
  char: HumanCharacter,
  _ballPos: THREE.Vector3,
  time: number,
  dt: number,
  phase: SimPhase,
  presenceWeight = 1,
  fieldGatherBlend = 0,
): void {
  applyNeutralPose(char, {
    phase,
    phaseProgress: 0,
    bowlerType: 'Fast',
    shotType: 'defend',
    dt,
    time,
  }, presenceWeight);

  if (phase === 'bowl' || phase === 'hit') {
    char.bones.chest.rotation.x += 0.035 * presenceWeight;
    char.bones.upperArmL.rotation.z += 0.035 * presenceWeight;
    char.bones.upperArmR.rotation.z -= 0.035 * presenceWeight;
  }

  const w = THREE.MathUtils.clamp(fieldGatherBlend, 0, 1) * presenceWeight;
  if (w <= 0) return;

  const { bones } = char;
  bones.chest.rotation.x += -0.45 * w;
  bones.neck.rotation.x += -0.22 * w;
  bones.pelvis.rotation.x += 0.18 * w;
  bones.thighL.rotation.x += 0.35 * w;
  bones.thighR.rotation.x += 0.35 * w;
  bones.calfL.rotation.x += -0.45 * w;
  bones.calfR.rotation.x += -0.45 * w;
  bones.upperArmR.rotation.x += 0.75 * w;
  bones.lowerArmR.rotation.x += -0.55 * w;
  bones.head.rotation.x += 0.22 * w;
}

export function animateHuman(char: HumanCharacter, input: AnimatorInput): void {
  applyNeutralPose(char, input, input.presenceWeight ?? 1);
}
