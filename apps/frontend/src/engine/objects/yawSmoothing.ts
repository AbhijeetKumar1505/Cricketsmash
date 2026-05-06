import * as THREE from 'three';

/** Shortest signed angle from `from` to `to` (radians). */
export function shortestAngleDiff(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/**
 * Step `current` toward `target` on the circle, capped by max turn rate.
 */
export function smoothYawToward(
  current: number,
  target: number,
  maxTurnRadPerSec: number,
  dt: number,
): number {
  const diff = shortestAngleDiff(current, target);
  const maxStep = maxTurnRadPerSec * dt;
  const step = THREE.MathUtils.clamp(diff, -maxStep, maxStep);
  return current + step;
}

/** Clamp yaw to stay within ±halfArc of stance (e.g. face pitch, track ball within 45°). */
export function clampYawRelativeToStance(
  yaw: number,
  stanceYaw: number,
  halfArc: number = Math.PI / 4,
): number {
  return THREE.MathUtils.clamp(yaw, stanceYaw - halfArc, stanceYaw + halfArc);
}

/** XZ yaw from self toward target (Three.js Y rotation convention). */
export function yawTowardXZ(selfX: number, selfZ: number, targetX: number, targetZ: number): number {
  return Math.atan2(targetX - selfX, targetZ - selfZ);
}
