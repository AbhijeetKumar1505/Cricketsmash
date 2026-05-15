
/**
 * Facial geometry parameters that drive per-avatar head shaping in HumanCharacter.
 * All values are multipliers around 1.0 = default, unless noted.
 */
export interface FaceProfile {
  // ── Head shape ──────────────────────────────────────────────────────────────
  /** Jaw / mid-face width scale. 0.85=narrow/angular, 1.0=default, 1.35=wide/jowly. */
  jawWidth: number;
  /** Cheek puffiness from 0 (hollow) to 1 (very chubby). */
  cheekFull: number;
  /** Forehead height scale. 0.85=low/receding, 1.0=default, 1.2=domed. */
  foreheadH: number;

  // ── Nose ────────────────────────────────────────────────────────────────────
  /** Nose width relative to default. 0.75=narrow, 1.0=default, 1.4=broad. */
  noseW: number;
  /** Nose protrusion / prominence. 0.8=flat, 1.0=default, 1.3=large. */
  noseL: number;

  // ── Eyes ────────────────────────────────────────────────────────────────────
  /** Overall eye disc size scale. 0.8=small/squinting, 1.0=default, 1.2=large/open. */
  eyeScale: number;
  /** Eye X separation scale. 0.85=close-set, 1.0=default, 1.15=wide-set. */
  eyeSpacing: number;

  // ── Eyebrows ────────────────────────────────────────────────────────────────
  /** Brow thickness multiplier. 0.5=thin/arched, 1.0=default, 2.5=very bushy. */
  browThick: number;
  /**
   * Brow tilt override (radians).
   * Positive = outer corner raised (cheerful/arched).
   * Negative = inner corner raised (stern/furrowed).
   * The final rotation is base 0.28 − browTilt.
   */
  browTilt: number;
  /** Extra vertical position of brows relative to eyes. 0=default, +0.05=higher. */
  browHeight: number;

  // ── Mouth ───────────────────────────────────────────────────────────────────
  /** Mouth width scale. 0.7=tight/pursed, 1.0=default, 1.3=wide. */
  mouthW: number;
  /**
   * Vertical offset of mouth along the chin axis.
   * 0=default position. +0.1=lower (longer chin). −0.1=higher.
   */
  mouthYShift: number;
}

export interface AvatarProfile {
  id: string;
  name: string;
  skinColor: number;
  hairColor: number;
  shirtColor: number;
  shortsColor: number;
  shoeColor: number;
  eyeColor: number;
  heightScale: number;
  widthScale: number;
  hairType: 'standard' | 'bald' | 'spiky' | 'side-part' | 'pompadour' | 'flat-top';
  beardType?: 'none' | 'stubble' | 'full';
  face?: FaceProfile;
}

// ── Helper: default face profile (neutral) ────────────────────────────────────
const DEFAULT_FACE: FaceProfile = {
  jawWidth: 1.00, cheekFull: 0.20, foreheadH: 1.00,
  noseW: 1.00, noseL: 1.00,
  eyeScale: 1.00, eyeSpacing: 1.00,
  browThick: 1.00, browTilt: 0.00, browHeight: 0.00,
  mouthW: 1.00, mouthYShift: 0.00,
};

export const AVATARS: Record<string, AvatarProfile> = {

  // ── Level 1 batsman ─────────────────────────────────────────────────────────
  'modi': {
    id: 'modi',
    name: 'N. Modi',
    skinColor: 0xd49a73,
    hairColor: 0xffffff,    // white hair
    shirtColor: 0xffffff,
    shortsColor: 0x224422,
    shoeColor: 0x111111,
    eyeColor: 0x3a1a00,     // warm dark brown
    heightScale: 0.95,
    widthScale: 1.08,
    hairType: 'side-part',
    beardType: 'full',
    face: {
      jawWidth: 1.04, cheekFull: 0.28, foreheadH: 1.10,
      noseW: 1.06, noseL: 1.00,
      eyeScale: 0.96, eyeSpacing: 0.95,
      browThick: 1.55, browTilt: 0.06, browHeight: 0.01,
      mouthW: 0.88, mouthYShift: 0.06,
    },
  },

  // ── Level 2 batsman ─────────────────────────────────────────────────────────
  'trump': {
    id: 'trump',
    name: 'D. Trump',
    skinColor: 0xffaa60,    // distinctively warm/orange tone
    hairColor: 0xffcc33,    // golden yellow
    shirtColor: 0xffffff,
    shortsColor: 0x111144,
    shoeColor: 0x111111,
    eyeColor: 0x5599ff,     // blue
    heightScale: 1.04,
    widthScale: 1.20,
    hairType: 'pompadour',
    beardType: 'none',
    face: {
      jawWidth: 1.22, cheekFull: 0.55, foreheadH: 0.92,
      noseW: 1.16, noseL: 1.08,
      eyeScale: 0.82, eyeSpacing: 0.88,
      browThick: 1.85, browTilt: -0.14, browHeight: -0.01,
      mouthW: 1.06, mouthYShift: 0.08,
    },
  },

  // ── Level 3 batsman ─────────────────────────────────────────────────────────
  'kim': {
    id: 'kim',
    name: 'J. Un',
    skinColor: 0xffdbac,
    hairColor: 0x060606,    // near-black
    shirtColor: 0x111111,
    shortsColor: 0x0a0a0a,
    shoeColor: 0x050505,
    eyeColor: 0x1a0d00,     // very dark brown
    heightScale: 0.90,
    widthScale: 1.32,       // noticeably wider / rounder
    hairType: 'flat-top',
    beardType: 'none',
    face: {
      jawWidth: 1.35, cheekFull: 0.82, foreheadH: 1.04,
      noseW: 1.18, noseL: 0.86,
      eyeScale: 0.84, eyeSpacing: 0.90,
      browThick: 1.18, browTilt: 0.00, browHeight: -0.01,
      mouthW: 0.88, mouthYShift: 0.02,
    },
  },

  // ── Level 4 batsman ─────────────────────────────────────────────────────────
  'putin': {
    id: 'putin',
    name: 'V. Putin',
    skinColor: 0xf0cfaf,
    hairColor: 0xaaaaaa,    // grey (near-bald)
    shirtColor: 0x1a1a22,
    shortsColor: 0x111118,
    shoeColor: 0x050508,
    eyeColor: 0x4488ee,     // pale blue (cold)
    heightScale: 1.00,
    widthScale: 1.00,
    hairType: 'bald',
    beardType: 'none',
    face: {
      jawWidth: 0.92, cheekFull: 0.08, foreheadH: 1.08,
      noseW: 0.95, noseL: 1.06,
      eyeScale: 0.88, eyeSpacing: 0.92,
      browThick: 1.22, browTilt: -0.10, browHeight: 0.00,
      mouthW: 0.85, mouthYShift: 0.06,
    },
  },

  // ── Fielder squad ────────────────────────────────────────────────────────────
  'meloni': {
    id: 'meloni',
    name: 'G. Meloni',
    skinColor: 0xffd5aa,
    hairColor: 0xf5e090,    // warm blonde
    shirtColor: 0xfafafa,
    shortsColor: 0x1a5c30,
    shoeColor: 0xfafafa,
    eyeColor: 0x5577ee,     // blue-grey
    heightScale: 0.90,
    widthScale: 0.88,
    hairType: 'standard',
    beardType: 'none',
    face: {
      jawWidth: 0.85, cheekFull: 0.10, foreheadH: 1.06,
      noseW: 0.82, noseL: 0.90,
      eyeScale: 1.08, eyeSpacing: 1.05,
      browThick: 0.82, browTilt: 0.12, browHeight: 0.02,
      mouthW: 0.96, mouthYShift: 0.08,
    },
  },

  // ── Bowler ───────────────────────────────────────────────────────────────────
  'munir': {
    id: 'munir',
    name: 'A. Munir',
    skinColor: 0xc8845a,
    hairColor: 0x080808,    // black
    shirtColor: 0x004422,
    shortsColor: 0x003318,
    shoeColor: 0x111111,
    eyeColor: 0x2a1200,     // dark brown
    heightScale: 1.06,
    widthScale: 1.02,
    hairType: 'standard',
    beardType: 'stubble',
    face: {
      jawWidth: 1.04, cheekFull: 0.20, foreheadH: 1.02,
      noseW: 1.12, noseL: 1.08,
      eyeScale: 1.00, eyeSpacing: 0.95,
      browThick: 1.30, browTilt: 0.00, browHeight: 0.00,
      mouthW: 0.90, mouthYShift: 0.04,
    },
  },
};

/** Returns the face profile for an avatar, falling back to the neutral default. */
export function getFaceProfile(avatarId: string): FaceProfile {
  return AVATARS[avatarId]?.face ?? DEFAULT_FACE;
}
