import * as THREE from 'three';
import { SIM, WORLD } from './layout.js';

/**
 * Maps legacy 2D simulator coordinates to true 3D spatial world projection.
 * The pitch is aligned STRICTLY along the Z-axis (Bowler at Z=+10, Batsman at Z=-10).
 * True depth perspective removes any fake resizing math needed by earlier engines.
 */
export function screenToWorld(sx: number, sy: number, sScale = 1): THREE.Vector3 {
  // Normalize screen X (length of pitch) across -0.5 to 0.5 span
  const nz = sx / SIM.W - 0.5;
  const h = (SIM.GY - sy) * WORLD.heightScale;
  
  // Z maps to the length of the pitch (flipped to face the camera correctly)
  const z = -nz * WORLD.pitchHalfLength * 2; 
  
  const y = WORLD.groundY + WORLD.ballRadius + Math.max(0.04, h);
  
  // Map historical 2D scaling to true horizontal deviations (swing/off-spin on the X axis)
  const deviationX = (1 - sScale) * 10 * WORLD.pitchHalfWidth;
  
  return new THREE.Vector3(deviationX, y, z);
}

export function screenGroundPoint(sx: number, deviationX = 0): THREE.Vector3 {
  const nz = sx / SIM.W - 0.5;
  const z = -nz * WORLD.pitchHalfLength * 2;
  return new THREE.Vector3(deviationX, WORLD.groundY + 0.02, z);
}
