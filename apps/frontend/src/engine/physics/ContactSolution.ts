import { Vec3 } from './physics.js';

export interface ContactSolution {
  contactTime: number;
  contactPointWorld: Vec3;
  desiredContactHeight: number;
  requiredSwingDuration: number;
}
