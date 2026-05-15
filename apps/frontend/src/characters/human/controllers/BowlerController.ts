import { CharacterController } from './CharacterController.js';
import type { EngineSnapshot } from '../../../engine/GameEngine.js';

export class BowlerController extends CharacterController {
  protected override transition(phase: string, snap: EngineSnapshot): void {
    super.transition(phase, snap);
    if (phase === 'BOWLER_RUNUP' || phase === 'BALL_RELEASE' || phase === 'BALL_TRAVEL') {
      this.state = 'Execute';
      const t = snap.bowler.runT ?? 0;
      this.subState = t < 0.55 ? 'gather' : t < 0.85 ? 'lift' : 'release';
    }
  }
}
