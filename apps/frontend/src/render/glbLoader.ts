import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// ── Shared GLB loader with compression decoders ───────────────────────────────
//
// Our GLB assets (characters + bonus props) are compressed offline with
// `gltf-transform` (Draco geometry + WebP textures). To read them in the browser
// the GLTFLoader needs a DRACOLoader + meshopt decoder configured. WebP textures
// decode natively (no extra loader). KTX2 is intentionally NOT wired here because
// KTX2Loader.detectSupport() requires a live WebGLRenderer, which does not exist at
// module-load time when these loaders are constructed as singletons.
//
// Decoder runtime files are copied into `public/decoders/draco/` by the
// `copy:decoders` npm script (sourced from three/examples/jsm/libs/draco/gltf).

let _draco: DRACOLoader | null = null;

function sharedDraco(): DRACOLoader {
  if (_draco) return _draco;
  _draco = new DRACOLoader();
  // Served statically by Vite from apps/frontend/public/decoders/draco/.
  _draco.setDecoderPath('/decoders/draco/');
  // WASM decoder is faster and smaller than the JS fallback.
  _draco.setDecoderConfig({ type: 'wasm' });
  return _draco;
}

/**
 * Build a GLTFLoader wired for Draco + meshopt decompression.
 * Uncompressed GLBs still load unchanged — the decoders sit unused until needed.
 */
export function createGlbLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(sharedDraco());
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}
