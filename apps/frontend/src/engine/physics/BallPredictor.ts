import { Vec3, clamp } from './physics.js';
import { WORLD, BALL } from '../constants.js';
import type { ContactSolution } from './ContactSolution.js';

/**
 * Predict when and WHERE the ball will reach the batsman.
 *
 * contactPointWorld is now the ball's projected position on ALL THREE axes — not
 * a hardcoded crease point. Previously x/z were pinned to (0, WORLD.BATSMAN_Z),
 * which aimed the IK ~0.5m behind the real ball (the ball arrives in front of the
 * crease and slightly off-centre). Each horizontal axis is a linear forward
 * projection; Y keeps its ballistic gravity term. Results are clamped to a
 * reachable contact envelope so a bad prediction cannot send the arm IK out of range.
 *
 * @param ballY/ballVy  current ball vertical position / velocity (m, m/s)
 * @param ballX/ballZ   current ball horizontal position (metres)
 * @param ballVx/ballVz current ball horizontal velocity (m/s)
 */
export function predictContact(
  hitTime:     number,
  ballElapsed: number,
  fsmTotalRun: number,
  ballY:       number,
  ballVy:      number,
  ballX:       number,
  ballZ:       number,
  ballVx:      number,
  ballVz:      number,
): ContactSolution {
  const timeToContact = Math.max(0, hitTime - ballElapsed);
  const contactTime   = fsmTotalRun + timeToContact;

  const zSpeed = (0 - WORLD.RELEASE_Z) / hitTime;
  const requiredSwingDuration = clamp(0.12, 0.35, 0.50 - zSpeed * 0.008);

  // Y: ballistic projection y + vy·t − ½·g·t²
  const contactY = clamp(
    ballY + ballVy * timeToContact - 0.5 * BALL.GRAVITY * timeToContact * timeToContact,
    0.25,  // near-yorker floor
    2.50,  // high full-toss ceiling
  );
  // X/Z: linear projection, clamped to a reachable contact envelope around the
  // batsman (x = leg/off spread, z = how far in front of the crease).
  const contactX = clamp(ballX + ballVx * timeToContact, -0.60, 0.60);
  const contactZ = clamp(ballZ + ballVz * timeToContact, -1.00, 0.40);

  return {
    contactTime,
    contactPointWorld:    new Vec3(contactX, contactY, contactZ),
    desiredContactHeight: contactY,
    requiredSwingDuration,
  };
}
