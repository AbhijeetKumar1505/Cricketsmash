/**
 * LayerResolver — per-character layer orchestration.
 *
 * One LayerSet per character. Layers apply in priority order:
 *
 *   LOCOMOTION → ROLE → REACTION → HEAD → SPRING → IK
 *
 * Each layer has its own BoneAccumulator. beginFrame() clears all targets.
 * applyAll() applies layers in order — lower-priority layers' setRot is
 * blocked by higher-priority layers' ownership.
 *
 * Springs are a special post-step (applySprings → applyAdditive) because
 * they read the bone's current rotation to compute a lag delta. They run
 * after applyAll() via their own accumulator.
 */

import type { CharacterInstance } from '../CharacterManager.js';
import { BoneAccumulator } from './BoneAccumulator.js';
import { LayerId, LAYER_COUNT } from './BoneLayer.js';

export class LayerSet {
  private readonly _accs = new Array<BoneAccumulator | null>(LAYER_COUNT).fill(null);

  /** Access the accumulator for a specific layer. */
  acc(layer: LayerId): BoneAccumulator {
    let a = this._accs[layer];
    if (!a) { a = new BoneAccumulator(); this._accs[layer] = a; }
    return a;
  }

  /** Clear all layer targets for a new frame. */
  beginFrame(): void {
    for (let i = 0; i < LAYER_COUNT; i++) {
      this._accs[i]?.begin();
    }
  }

  /** Full reset — clears all accumulators. Call when switching characters. */
  reset(): void {
    for (let i = 0; i < LAYER_COUNT; i++) {
      this._accs[i]?.reset();
    }
  }

  /**
   * Apply all layers in priority order (LOCOMOTION first, IK last).
   *
   * - setRot only writes to bones this layer owns (per BONE_OWNERSHIP).
   * - addRot always stacks on current bone rotation (mixer + previous layers).
   * - Bones with no target retain whatever the mixer wrote.
   */
  applyAll(char: CharacterInstance): void {
    for (let i = 0; i < LAYER_COUNT; i++) {
      this._accs[i]?.apply(char, i as LayerId);
    }
  }
}
