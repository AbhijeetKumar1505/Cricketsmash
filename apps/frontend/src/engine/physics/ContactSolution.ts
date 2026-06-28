import { Vec3 } from './physics.js';

/** Dev-only snapshot of the inputs predictContact() used, for diagnosing target error. */
export interface PredictDebug {
  hitTime:       number;
  elapsed:       number;
  timeToContact: number;
  contactPoint: [number, number, number];
}

export interface ContactSolution {
  contactTime: number;
  contactPointWorld: Vec3;
  desiredContactHeight: number;
  requiredSwingDuration: number;
  debug?: PredictDebug;
}
