/**
 * BoneAccumulator — per-frame, per-layer bone-target accumulator.
 *
 * Each layer in the animation stack gets its own accumulator. Layers write
 * setRot/addRot targets. The resolver applies layers in priority order:
 *
 *   LOCOMOTION → ROLE → REACTION → HEAD → SPRING → IK
 *
 * Layer rules:
 *   • setRot is ABSOLUTE — replaces whatever the bone currently has.
 *     Only applies if this layer OWNS the bone (per BONE_OWNERSHIP).
 *   • addRot is ADDITIVE — stacks on top of all previous layers + mixer output.
 *     Always applies, regardless of ownership.
 *   • Bones with NO target from any layer retain the mixer's animation output.
 *
 * This replaces the old "capture rest once, then overwrite everything" approach.
 * Now mixer output survives on bones no layer touches, and each layer only
 * claims bones it owns.
 */

import * as THREE from 'three';
import type { CharacterInstance } from '../CharacterManager.js';
import { canSetRot, type LayerId } from './BoneLayer.js';

interface BoneTarget {
  rotX: number | null; rotY: number | null; rotZ: number | null;
  addRotX: number; addRotY: number; addRotZ: number;
  posX: number | null; posY: number | null; posZ: number | null;
  addPosX: number; addPosY: number; addPosZ: number;
}

function emptyTarget(): BoneTarget {
  return {
    rotX: null, rotY: null, rotZ: null,
    addRotX: 0, addRotY: 0, addRotZ: 0,
    posX: null, posY: null, posZ: null,
    addPosX: 0, addPosY: 0, addPosZ: 0,
  };
}

function clearTarget(t: BoneTarget): void {
  t.rotX = null; t.rotY = null; t.rotZ = null;
  t.addRotX = 0; t.addRotY = 0; t.addRotZ = 0;
  t.posX = null; t.posY = null; t.posZ = null;
  t.addPosX = 0; t.addPosY = 0; t.addPosZ = 0;
}

export class BoneAccumulator {
  private targets = new Map<string, BoneTarget>();

  /** Clear all targets for a new frame. Call before writing fresh targets. */
  begin(): void {
    for (const t of this.targets.values()) clearTarget(t);
  }

  /** Full reset — clears all state. Call when switching characters. */
  reset(): void {
    this.targets.clear();
  }

  setRot(bone: string, x: number, y: number, z: number): void {
    const t = this._entry(bone);
    t.rotX = x; t.rotY = y; t.rotZ = z;
  }

  setRotEuler(bone: string, e: THREE.Euler): void {
    this.setRot(bone, e.x, e.y, e.z);
  }

  addRot(bone: string, x: number, y: number, z: number): void {
    const t = this._entry(bone);
    t.addRotX += x; t.addRotY += y; t.addRotZ += z;
  }

  setPos(bone: string, x: number, y: number, z: number): void {
    const t = this._entry(bone);
    t.posX = x; t.posY = y; t.posZ = z;
  }

  addPos(bone: string, x: number, y: number, z: number): void {
    const t = this._entry(bone);
    t.addPosX += x; t.addPosY += y; t.addPosZ += z;
  }

  /**
   * Write accumulated targets to the character's bones.
   *
   * @param char  — the character instance
   * @param owner — the layer applying. When set, setRot only writes to bones
   *                this layer owns (per BONE_OWNERSHIP). Bones the layer
   *                doesn't own retain their current rotation from previous
   *                layers / mixer. addRot always stacks on current.
   *
   * When owner is undefined (legacy use), all setRot targets are applied
   * unconditionally — matching old behavior.
   */
  apply(char: CharacterInstance, owner?: LayerId): void {
    for (const [name, t] of this.targets.entries()) {
      const bone = char.bones.get(name);
      if (!bone) continue;

      // Determine which bones get setRot (absolute override)
      const applyXRot = t.rotX !== null && (owner === undefined || canSetRot(owner, name));
      const applyYRot = t.rotY !== null && (owner === undefined || canSetRot(owner, name));
      const applyZRot = t.rotZ !== null && (owner === undefined || canSetRot(owner, name));

      bone.rotation.set(
        (applyXRot ? t.rotX! : bone.rotation.x) + t.addRotX,
        (applyYRot ? t.rotY! : bone.rotation.y) + t.addRotY,
        (applyZRot ? t.rotZ! : bone.rotation.z) + t.addRotZ,
      );

      const applyXPos = t.posX !== null && (owner === undefined || canSetRot(owner, name));
      const applyYPos = t.posY !== null && (owner === undefined || canSetRot(owner, name));
      const applyZPos = t.posZ !== null && (owner === undefined || canSetRot(owner, name));

      bone.position.set(
        (applyXPos ? t.posX! : bone.position.x) + t.addPosX,
        (applyYPos ? t.posY! : bone.position.y) + t.addPosY,
        (applyZPos ? t.posZ! : bone.position.z) + t.addPosZ,
      );
    }
  }

  private _entry(bone: string): BoneTarget {
    let t = this.targets.get(bone);
    if (!t) { t = emptyTarget(); this.targets.set(bone, t); }
    return t;
  }
}
