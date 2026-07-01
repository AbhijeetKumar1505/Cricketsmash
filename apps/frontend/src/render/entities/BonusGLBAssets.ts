import * as THREE from 'three';
import { createGlbLoader } from '../glbLoader.js';

type BonusGLBKey = 'rover' | 'spider' | 'aircraft';

const URLS: Record<BonusGLBKey, string> = {
  rover:    '/players/rover.glb',
  spider:   '/players/spidycam.glb',
  aircraft: '/players/Aircraft.glb',
};

/** Target longest-axis world size (metres) after normalization. */
const TARGET_SIZES: Record<BonusGLBKey, number> = {
  rover:    0.65,
  spider:   0.55,
  aircraft: 3.0,
};

/** Post-process a loaded GLTF scene so it's visible without scene lighting. */
function processScene(key: BonusGLBKey, scene: THREE.Group): void {
  // Force world-matrix computation before Box3 reads them.
  scene.updateMatrixWorld(true);

  // Per-mesh union is more reliable than setFromObject on an un-rendered scene.
  const box = new THREE.Box3();
  scene.traverse(o => {
    if (o instanceof THREE.Mesh && o.geometry) {
      box.union(new THREE.Box3().setFromObject(o));
    }
  });

  if (!box.isEmpty()) {
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) scene.scale.setScalar(TARGET_SIZES[key] / maxDim);
  } else {
    scene.scale.setScalar(0.5);
  }

  // Convert MeshStandardMaterial → MeshBasicMaterial so models are visible
  // without scene lights (ground-level props receive no useful illumination).
  scene.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    o.frustumCulled = false;
    const raw = o.material;
    const mats: THREE.Material[] = Array.isArray(raw) ? raw : [raw];
    const basics = mats.map(m => {
      const color = m instanceof THREE.MeshStandardMaterial ? m.color.clone()
        : new THREE.Color(0xcccccc);
      const map = m instanceof THREE.MeshStandardMaterial ? (m.map ?? null) : null;
      const basic = new THREE.MeshBasicMaterial({ color, map });
      m.dispose();
      return basic;
    });
    o.material = basics.length === 1 ? basics[0]! : basics;
  });
}

class BonusGLBAssets {
  private readonly _cache = new Map<BonusGLBKey, THREE.Group>();
  private readonly _loader = createGlbLoader();
  private _preloadPromise: Promise<void> | null = null;

  preload(): Promise<void> {
    if (this._preloadPromise) return this._preloadPromise;
    this._preloadPromise = Promise.all(
      (Object.entries(URLS) as [BonusGLBKey, string][]).map(([key, url]) =>
        this._loader.loadAsync(url).then(gltf => {
          processScene(key, gltf.scene);
          this._cache.set(key, gltf.scene);
        }).catch(err => {
          console.warn(`[BonusGLBAssets] Failed to load ${url}:`, err);
        })
      )
    ).then(() => undefined);
    return this._preloadPromise;
  }

  getClone(key: BonusGLBKey): THREE.Group | null {
    const src = this._cache.get(key);
    return src ? src.clone(true) : null;
  }

  isLoaded(key: BonusGLBKey): boolean {
    return this._cache.has(key);
  }
}

export const bonusGLBAssets = new BonusGLBAssets();
