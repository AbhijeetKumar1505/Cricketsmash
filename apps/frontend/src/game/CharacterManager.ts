import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

// ── Rigged character manifest ─────────────────────────────────────────────────
// Each entry lists the base GLB (Walking — provides mesh + skeleton + walk clip)
// and optional extra clip GLBs. All meshes share the same 24-bone plain rig.

interface CharacterRig {
  /** Walking GLB — canonical mesh, skeleton, and "walk" animation clip. */
  walk: string;
  /** Running GLB — only the "run" clip is extracted from this file. */
  run: string;
  /** Optional character-specific celebration clip. */
  celebrate?: string;
}

const RIGS: Record<string, CharacterRig> = {
  modi: {
    walk:      '/rigs/modi_rig/Meshy_AI_Timeless_Indian_Gentl_biped/Meshy_AI_Timeless_Indian_Gentl_biped_Animation_Walking_withSkin.glb',
    run:       '/rigs/modi_rig/Meshy_AI_Timeless_Indian_Gentl_biped/Meshy_AI_Timeless_Indian_Gentl_biped_Animation_Running_withSkin.glb',
  },
  trump: {
    walk:      '/rigs/trump_rig/Meshy_AI_Executive_Portrait_in_biped/Meshy_AI_Executive_Portrait_in_biped_Animation_Walking_withSkin.glb',
    run:       '/rigs/trump_rig/Meshy_AI_Executive_Portrait_in_biped/Meshy_AI_Executive_Portrait_in_biped_Animation_Running_withSkin.glb',
    celebrate: '/rigs/trump_rig/Meshy_AI_Executive_Portrait_in_biped/Meshy_AI_Executive_Portrait_in_biped_Animation_Breakdance_1990_withSkin.glb',
  },
  putin: {
    walk:      '/rigs/putin_rig/Meshy_AI_Executive_Portrait_in_biped/Meshy_AI_Executive_Portrait_in_biped_Animation_Walking_withSkin.glb',
    run:       '/rigs/putin_rig/Meshy_AI_Executive_Portrait_in_biped/Meshy_AI_Executive_Portrait_in_biped_Animation_Running_withSkin.glb',
    celebrate: '/rigs/putin_rig/Meshy_AI_Executive_Portrait_in_biped/Meshy_AI_Executive_Portrait_in_biped_Animation_Cardio_Dance_withSkin.glb',
  },
  adeft: {
    walk:      '/rigs/adeft_rig/Meshy_AI_The_Cartographer_biped/Meshy_AI_The_Cartographer_biped_Animation_Walking_withSkin.glb',
    run:       '/rigs/adeft_rig/Meshy_AI_The_Cartographer_biped/Meshy_AI_The_Cartographer_biped_Animation_Running_withSkin.glb',
  },
  meloni: {
    walk:      '/rigs/meloni_rig/Meshy_AI_Pale_Blue_Power_Suit_biped/Meshy_AI_Pale_Blue_Power_Suit_biped_Animation_Walking_withSkin.glb',
    run:       '/rigs/meloni_rig/Meshy_AI_Pale_Blue_Power_Suit_biped/Meshy_AI_Pale_Blue_Power_Suit_biped_Animation_Running_withSkin.glb',
    celebrate: '/rigs/meloni_rig/Meshy_AI_Pale_Blue_Power_Suit_biped/Meshy_AI_Pale_Blue_Power_Suit_biped_Animation_Backflip_and_Hooks_withSkin.glb',
  },
  ronaldo: {
    walk:      '/rigs/ronaldo_rig/Meshy_AI_Portugal_s_Rising_Str_biped/Meshy_AI_Portugal_s_Rising_Str_biped_Animation_Walking_withSkin.glb',
    run:       '/rigs/ronaldo_rig/Meshy_AI_Portugal_s_Rising_Str_biped/Meshy_AI_Portugal_s_Rising_Str_biped_Animation_Running_withSkin.glb',
  },
  kimjong: {
    walk:      '/rigs/kimjong_rig/Meshy_AI_Formal_Portrait_in_a__biped/Meshy_AI_Formal_Portrait_in_a__biped_Animation_Walking_withSkin.glb',
    run:       '/rigs/kimjong_rig/Meshy_AI_Formal_Portrait_in_a__biped/Meshy_AI_Formal_Portrait_in_a__biped_Animation_Running_withSkin.glb',
  },
};

export type PlayerId = keyof typeof RIGS;

// Retained for external code that references PLAYERS (CharacterPanel, etc.)
export const PLAYERS = Object.fromEntries(
  Object.entries(RIGS).map(([id, r]) => [id, r.walk])
) as Record<PlayerId, string>;

export interface CharacterInstance {
  readonly id: PlayerId;
  readonly root: THREE.Object3D;
  readonly skinnedMesh: THREE.SkinnedMesh | null;
  readonly mixer: THREE.AnimationMixer;
  /** All clips with canonical names: "walk", "run", "celebrate" */
  readonly clips: THREE.AnimationClip[];
  /** Flat bone lookup by canonical name → bone */
  readonly bones: Map<string, THREE.Bone>;
}

// ── GLTF cache (load-once) ────────────────────────────────────────────────────

const _loader  = new GLTFLoader();
const _cache   = new Map<string, GLTF>();        // url → loaded GLTF
const _inflight = new Map<string, Promise<void>>(); // url → pending load

function loadGltf(url: string): Promise<void> {
  if (_cache.has(url)) return Promise.resolve();
  const existing = _inflight.get(url);
  if (existing) return existing;
  const p = _loader.loadAsync(url).then(gltf => {
    _cache.set(url, gltf);
    _inflight.delete(url);
  });
  _inflight.set(url, p);
  return p;
}

export function preloadCharacter(id: PlayerId): Promise<void> {
  const rig = RIGS[id];
  if (!rig) return Promise.resolve();
  return Promise.all([
    loadGltf(rig.walk),
    loadGltf(rig.run),
    rig.celebrate ? loadGltf(rig.celebrate) : Promise.resolve(),
  ]).then(() => undefined);
}

export function preloadAll(): Promise<void> {
  return Promise.all((Object.keys(RIGS) as PlayerId[]).map(preloadCharacter)).then(() => undefined);
}

// ── Clip name normaliser ──────────────────────────────────────────────────────
// Raw clip name format from Meshy AI: "Armature|<action>|baselayer"

const CLIP_NAME_MAP: Record<string, string> = {
  walking_man:                      'walk',
  running:                          'run',
  Backflip_and_Hooks:               'celebrate',
  Boxing_Guard_Prep_Straight_Punch: 'punch',
  Cardio_Dance:                     'celebrate',
  '360_Power_Spin_Jump':            'celebrate',
  Breakdance_1990:                  'celebrate',
  Cherish_Pop_Dance:                'celebrate',
};

function normalizeClipName(raw: string): string {
  const action = raw.split('|')[1] ?? raw;
  return CLIP_NAME_MAP[action] ?? action.toLowerCase().replace(/[\s-]+/g, '_');
}

// ── Bone alias resolver ───────────────────────────────────────────────────────
// Supports plain (Hips/Spine01), Mixamo (mixamorigHips), and colon-variant (mixamorig:Hips)

const BONE_ALIASES: Record<string, string[]> = {
  hips:          ['Hips', 'mixamorigHips', 'mixamorig:Hips', 'pelvis', 'Pelvis', 'Root', 'root'],
  spine:         ['Spine', 'mixamorigSpine', 'mixamorig:Spine', 'Spine_01', 'spine_01'],
  // "Spine01" is the Meshy AI name for the mid-chest bone — listed before the Mixamo variants
  chest:         ['Spine01', 'Spine1', 'mixamorigSpine1', 'mixamorig:Spine1', 'Spine_02', 'Chest', 'chest'],
  // "Spine02" is the upper-chest bone in Meshy AI rigs
  upperChest:    ['Spine02', 'Spine2', 'mixamorigSpine2', 'mixamorig:Spine2', 'Spine_03', 'UpperChest'],
  neck:          ['neck', 'Neck', 'mixamorigNeck', 'mixamorig:Neck'],
  head:          ['Head', 'mixamorigHead', 'mixamorig:Head', 'head'],
  leftShoulder:  ['LeftShoulder',  'mixamorigLeftShoulder',  'mixamorig:LeftShoulder',  'L_Shoulder', 'ShoulderL'],
  rightShoulder: ['RightShoulder', 'mixamorigRightShoulder', 'mixamorig:RightShoulder', 'R_Shoulder', 'ShoulderR'],
  leftArm:       ['LeftArm',       'mixamorigLeftArm',       'mixamorig:LeftArm',       'L_UpperArm', 'ArmL'],
  rightArm:      ['RightArm',      'mixamorigRightArm',      'mixamorig:RightArm',      'R_UpperArm', 'ArmR'],
  leftForeArm:   ['LeftForeArm',   'mixamorigLeftForeArm',   'mixamorig:LeftForeArm',   'L_ForeArm',  'ForeArmL'],
  rightForeArm:  ['RightForeArm',  'mixamorigRightForeArm',  'mixamorig:RightForeArm',  'R_ForeArm',  'ForeArmR'],
  leftHand:      ['LeftHand',      'mixamorigLeftHand',      'mixamorig:LeftHand',      'L_Hand',     'HandL'],
  rightHand:     ['RightHand',     'mixamorigRightHand',     'mixamorig:RightHand',     'R_Hand',     'HandR'],
  leftUpLeg:     ['LeftUpLeg',     'mixamorigLeftUpLeg',     'mixamorig:LeftUpLeg',     'L_UpperLeg', 'Thigh_L'],
  rightUpLeg:    ['RightUpLeg',    'mixamorigRightUpLeg',    'mixamorig:RightUpLeg',    'R_UpperLeg', 'Thigh_R'],
  leftLeg:       ['LeftLeg',       'mixamorigLeftLeg',       'mixamorig:LeftLeg',       'L_LowerLeg', 'Shin_L'],
  rightLeg:      ['RightLeg',      'mixamorigRightLeg',      'mixamorig:RightLeg',      'R_LowerLeg', 'Shin_R'],
  leftFoot:      ['LeftFoot',      'mixamorigLeftFoot',      'mixamorig:LeftFoot',      'L_Foot',     'FootL'],
  rightFoot:     ['RightFoot',     'mixamorigRightFoot',     'mixamorig:RightFoot',     'R_Foot',     'FootR'],
};

function buildBoneMap(root: THREE.Object3D): Map<string, THREE.Bone> {
  const byName = new Map<string, THREE.Bone>();
  root.traverse(obj => { if (obj instanceof THREE.Bone) byName.set(obj.name, obj); });

  const boneMap = new Map<string, THREE.Bone>();
  for (const [canonical, aliases] of Object.entries(BONE_ALIASES)) {
    for (const alias of aliases) {
      const bone = byName.get(alias);
      if (bone) { boneMap.set(canonical, bone); break; }
    }
  }
  return boneMap;
}

// ── Instantiation ─────────────────────────────────────────────────────────────

export function instantiateCharacter(id: PlayerId): CharacterInstance | null {
  const rig = RIGS[id];
  if (!rig) { console.warn(`[CharacterManager] Unknown player id "${id}"`); return null; }

  const baseGltf = _cache.get(rig.walk);
  if (!baseGltf) {
    console.warn(`[CharacterManager] "${id}" not loaded — call preloadCharacter first`);
    return null;
  }

  // Clone skeleton so multiple instances don't share bone state
  const root = skeletonClone(baseGltf.scene) as THREE.Object3D;

  // Fix root orientation: Three.js GLTFLoader handles Y-up internally, so any
  // extra rotation baked on the scene root by the exporter must be zeroed.
  // This prevents the common Meshy AI "upside-down" issue at no per-bone cost.
  root.rotation.set(0, 0, 0);
  root.updateMatrixWorld(true);

  let skinnedMesh: THREE.SkinnedMesh | null = null;
  root.traverse(obj => { if (obj instanceof THREE.SkinnedMesh && !skinnedMesh) skinnedMesh = obj; });

  const mixer = new THREE.AnimationMixer(root);
  const bones = buildBoneMap(root);

  // Diagnostic: log bone resolution count and flag sparse rigs
  const resolved = [...bones.keys()];
  const missing  = Object.keys(BONE_ALIASES).filter(k => !bones.has(k));
  if (bones.size < 20) {
    console.error(`[CharacterManager] SPARSE RIG: "${id}" resolved only ${bones.size}/20 bones — animation will be degraded`);
  }
  if (missing.length > 0) {
    console.warn(`[CharacterManager] "${id}" missing bones: ${missing.join(', ')}`);
  } else {
    console.log(`[CharacterManager] "${id}" ✓ ${resolved.length}/${Object.keys(BONE_ALIASES).length} bones resolved: ${resolved.join(', ')}`);
  }

  // Collect and rename all clips. Walk clip comes from base GLB.
  // Run + celebrate clips are extracted from their respective GLBs (same bone names = retarget-free).
  const clips: THREE.AnimationClip[] = [];

  const addClipsFrom = (url: string) => {
    const gltf = _cache.get(url);
    if (!gltf) return;
    for (const clip of gltf.animations) {
      const named = clip.clone();
      named.name = normalizeClipName(clip.name);
      // Avoid duplicate clip names (e.g. celebrate from multiple sources)
      if (!clips.some(c => c.name === named.name)) clips.push(named);
    }
  };

  addClipsFrom(rig.walk);
  addClipsFrom(rig.run);
  if (rig.celebrate) addClipsFrom(rig.celebrate);

  console.log(`[CharacterManager] "${id}" clips: ${clips.map(c => c.name).join(', ')}`);

  return { id, root, skinnedMesh, mixer, clips, bones };
}

// ── CharacterManager class ───────────────────────────────────────────────────

export class CharacterManager {
  private _batsmanId: PlayerId = 'modi';
  private readonly _bowlerId: PlayerId = 'meloni';
  private readonly _fielderId: PlayerId = 'ronaldo';

  private _batsman: CharacterInstance | null = null;
  private _fielder: CharacterInstance | null = null;
  private _bowler:  CharacterInstance | null = null;

  private _scene: THREE.Scene | null = null;

  setScene(scene: THREE.Scene): void { this._scene = scene; }

  async init(batsmanId: PlayerId = 'modi'): Promise<void> {
    await Promise.all([
      preloadCharacter(batsmanId),
      preloadCharacter('meloni'),
      preloadCharacter('ronaldo'),
    ]);
    this._batsmanId = batsmanId;
    this._batsman = instantiateCharacter(batsmanId);
    this._bowler  = instantiateCharacter('meloni');
    this._fielder = instantiateCharacter('ronaldo');
  }

  async switchBatsman(id: PlayerId): Promise<CharacterInstance | null> {
    await preloadCharacter(id);
    if (this._batsman && this._scene) this._scene.remove(this._batsman.root);
    this._batsmanId = id;
    this._batsman   = instantiateCharacter(id);
    if (this._batsman && this._scene) this._scene.add(this._batsman.root);
    return this._batsman;
  }

  async switchFielder(id: PlayerId): Promise<CharacterInstance | null> {
    await preloadCharacter(id);
    if (this._fielder && this._scene) this._scene.remove(this._fielder.root);
    this._fielder = instantiateCharacter(id);
    if (this._fielder && this._scene) this._scene.add(this._fielder.root);
    return this._fielder;
  }

  getCurrentBatsman(): PlayerId  { return this._batsmanId; }
  getCurrentFielder(): PlayerId  { return this._fielderId; }
  getBowler():         PlayerId  { return this._bowlerId; }

  getBatsmanInstance(): CharacterInstance | null { return this._batsman; }
  getFielderInstance(): CharacterInstance | null { return this._fielder; }
  getBowlerInstance():  CharacterInstance | null { return this._bowler; }

  update(_dt: number): void {
    // Mixer advancement is handled by AnimationBrain (respects CHARACTERS_STATIC flag).
    // This stub is kept so callers don't need to change.
  }

  dispose(): void {
    this._batsman = null;
    this._fielder = null;
    this._bowler  = null;
    this._scene   = null;
  }
}

export const characterManager = new CharacterManager();
