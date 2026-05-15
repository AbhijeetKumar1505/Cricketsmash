import { CharacterController } from './CharacterController.js';
import type { EngineSnapshot } from '../../../engine/GameEngine.js';

export class BatsmanController extends CharacterController {
  protected override chooseSubState(snap: EngineSnapshot): string | undefined {
    return snap.batsman.shotType ?? 'defend';
  }

  protected override chooseRecoverSubState(snap: EngineSnapshot): string | undefined {
    if (snap.batsman.phase === 'celebrate') return 'celebrate';
    if (snap.batsman.phase === 'stumped') return 'wicket';
    return 'settle';
  }
}
