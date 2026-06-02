/**
 * Shared reactive state for the animation debugger.
 * AnimationBrain writes here each frame when debug mode is active.
 * AnimDebugOverlay reads from here.
 */

export const animDebug = $state({
  // Bowler
  bowlerClip:          '—',
  bowlerPhase:         '—',
  bowlerBones:         0,
  bowlerClipTime:      0,
  bowlerClipDuration:  0,
  bowlerClipWeight:    0,
  bowlerMixerActive:   false,

  // Batsman
  batsmanClip:         '—',
  batsmanPhase:        '—',
  batsmanBones:        0,
  batsmanClipTime:     0,
  batsmanClipDuration: 0,
  batsmanClipWeight:   0,

  // Fielder[0]
  fielderClip: '—',

  // Mode flags
  proceduralEnabled: false,
  locoTestMode:      false,

  // Capability test (written when CAPABILITY_TEST_MODE is active)
  capTestPhase:    '—',
  capTestLookFor:  '—',
  capTestProgress: 0,

  // Bowl prototype test (written when BOWL_TEST_MODE is active)
  bowlTestPhase:   '—',
  bowlTestT:       0,
  bowlTestRelease: false,

  // Contact timing validation
  contactBallY:           0,
  contactBatY:            0,
  contactHeightError:     0,
  contactBallVelY:        0,
  contactBounceCount:     0,
  contactBatsmanPhase:    '—',
  contactBatsmanProgress: 0,
  contactDeliveryId:      0,
  contactFrame:           0,

  // Rolling summary
  contactLog: [] as ContactRecord[],

  active: false,
});

export interface ContactRecord {
  deliveryId: number;
  ballY: number;
  batY: number;
  heightError: number;
  ballVelY: number;
  bounceCount: number;
}
