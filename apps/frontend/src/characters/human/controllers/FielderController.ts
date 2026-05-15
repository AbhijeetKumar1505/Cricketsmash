import { CharacterController } from './CharacterController.js';
import type { ControllerInput } from './CharacterController.js';
import type { AnimatorInput } from '../HumanAnimator.js';

export type FielderStanceClass = 'crouch' | 'athletic' | 'deep' | 'lean';

export class FielderController extends CharacterController {
  private pickupBlend = 0;

  constructor(
    char: ConstructorParameters<typeof CharacterController>[0],
    public stance: FielderStanceClass = 'athletic',
    private readonly fielderSlot: number = 0,
  ) {
    super(char);
  }

  override update(input: ControllerInput): AnimatorInput {
    const base = super.update(input);
    const f = input.snapshot.fielders[this.fielderSlot];
    const target = f?.phase === 'gather' ? 1 : 0;
    const riseTau = 0.13;
    const fallTau = 0.16;
    if (target === 1) {
      this.pickupBlend = Math.min(1, this.pickupBlend + input.dt / riseTau);
    } else {
      this.pickupBlend = Math.max(0, this.pickupBlend - input.dt / fallTau);
    }
    return { ...base, fieldGatherBlend: this.pickupBlend };
  }
}
