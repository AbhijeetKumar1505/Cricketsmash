import type { HumanCharacter } from '../HumanCharacter.js';
import type { AnimatorInput } from '../HumanAnimator.js';
import type { EngineSnapshot } from '../../../engine/GameEngine.js';

export type ControllerState = 'Idle' | 'Ready' | 'React' | 'Execute' | 'Recover';

export interface ControllerInput {
  snapshot: EngineSnapshot;
  time: number;
  dt: number;
}

export class CharacterController {
  state: ControllerState = 'Idle';
  subState: string | undefined;

  constructor(public readonly char: HumanCharacter) {}

  update(input: ControllerInput): AnimatorInput {
    this.transition(input.snapshot.phase, input.snapshot);
    return {
      phase: snapshotToPhase(input.snapshot),
      phaseProgress: input.snapshot.bowler.runT ?? 0,
      bowlerType: input.snapshot.bowler.bowlerType ?? 'Fast',
      shotType: input.snapshot.batsman.shotType ?? 'defend',
      dt: input.dt,
      time: input.time,
      ballPos: { x: input.snapshot.ball.x, y: input.snapshot.ball.y, z: input.snapshot.ball.z } as any,
      isSwinging: input.snapshot.batsman.phase === 'swing' || input.snapshot.phase === 'HIT',
      hitQuality: input.snapshot.feedback.hitQuality ?? 'none',
      controllerState: this.state,
      controllerSubState: this.subState,
    };
  }

  protected transition(phase: string, snap: EngineSnapshot): void {
    if (phase === 'IDLE' || phase === 'BETTING' || phase === 'RESET') {
      this.state = 'Idle';
      this.subState = undefined;
    } else if (phase === 'BOWLER_RUNUP' || phase === 'BALL_RELEASE') {
      this.state = 'Ready';
      this.subState = undefined;
    } else if (phase === 'BALL_TRAVEL') {
      this.state = 'React';
      this.subState = undefined;
    } else if (phase === 'HIT') {
      this.state = 'Execute';
      this.subState = this.chooseSubState(snap);
    } else if (phase === 'BALL_RESULT') {
      this.state = 'Recover';
      this.subState = this.chooseRecoverSubState(snap);
    }
  }

  protected chooseSubState(_snap: EngineSnapshot): string | undefined {
    return undefined;
  }

  protected chooseRecoverSubState(_snap: EngineSnapshot): string | undefined {
    return undefined;
  }
}

function snapshotToPhase(snap: EngineSnapshot): AnimatorInput['phase'] {
  if (snap.batsman.phase === 'celebrate') return 'celebrate';
  if (snap.batsman.phase === 'stumped') return 'wicket';
  if (snap.batsman.phase === 'swing') return 'hit';
  if (snap.phase === 'BOWLER_RUNUP' || snap.phase === 'BALL_RELEASE' || snap.phase === 'BALL_TRAVEL') return 'bowl';
  if (snap.phase === 'HIT' || snap.phase === 'BALL_RESULT') return 'hit';
  return 'idle';
}
