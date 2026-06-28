import { Vec3, clamp } from './physics.js';
import { WORLD } from '../constants.js';
import type { ContactSolution } from './ContactSolution.js';

/**
 * Package the ball's contact position + swing timing into a ContactSolution.
 *
 * The contact position is SAMPLED from the deterministic pre-hit trajectory at the
 * moment the ball reaches the batsman (BallSystem.contactSample) — it is NOT a
 * velocity projection. Pre-hit velocities aren't maintained (ball.v* stay 0 during
 * flight), and the Bezier height arc isn't a gravity parabola, so projecting
 * produced ~1m of target error. Sampling the trajectory endpoint is exact.
 *
 * @param contactX/Y/Z  ball world position at the batsman (from contactSample)
 */
export function predictContact(
  hitTime:     number,
  ballElapsed: number,
  fsmTotalRun: number,
  contactX:    number,
  contactY:    number,
  contactZ:    number,
): ContactSolution {
  const timeToContact = Math.max(0, hitTime - ballElapsed);
  const contactTime   = fsmTotalRun + timeToContact;

  const zSpeed = (0 - WORLD.RELEASE_Z) / hitTime;
  const requiredSwingDuration = clamp(0.50 - zSpeed * 0.008, 0.12, 0.35);

  return {
    contactTime,
    contactPointWorld:    new Vec3(contactX, contactY, contactZ),
    desiredContactHeight: contactY,
    requiredSwingDuration,
    debug: {
      hitTime, elapsed: ballElapsed, timeToContact,
      contactPoint: [contactX, contactY, contactZ],
    },
  };
}
