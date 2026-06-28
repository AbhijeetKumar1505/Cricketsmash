/**
 * Sky Object Lite — standard-mode sky bonus visuals (sibling to BonusSystem).
 */

export type SkyObjectType = 'JETPACK' | 'SMALL_PLANE' | 'BIG_PLANE';

export type SkyObjectPhase = 'approaching' | 'impacted' | 'gone';

/** Serialized into Delivery / DeliveryOutcome for one delivery. */
export interface SkyObjectMeta {
  readonly type: SkyObjectType;
  readonly multiplier: 10 | 100;
}

export interface SkyObjectSnapshot {
  readonly id: string;
  readonly type: SkyObjectType;
  readonly phase: SkyObjectPhase;
  readonly position: { x: number; y: number; z: number };
  readonly scale: number;
  readonly glowFlash: number;
  /** Optional Y-axis heading (radians). Renderer uses this to orient the mesh. */
  readonly headingY?: number;
}
