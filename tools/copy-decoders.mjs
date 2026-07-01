// Copies the three.js Draco glTF decoder runtime into the frontend public dir so
// DRACOLoader (configured in src/render/glbLoader.ts with decoderPath
// '/decoders/draco/') can fetch them. Run after `npm install` / three upgrades.
//
//   node tools/copy-decoders.mjs
//
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = resolve(root, 'apps/frontend/public/decoders/draco');

// three may be hoisted to root or live in the frontend workspace (pnpm).
const candidates = [
  'node_modules/three/examples/jsm/libs/draco/gltf',
  'apps/frontend/node_modules/three/examples/jsm/libs/draco/gltf',
].map((p) => resolve(root, p));
const src = candidates.find((p) => existsSync(p));

if (!src) {
  console.error(`[copy-decoders] three Draco decoder not found. Looked in:\n  ${candidates.join('\n  ')}`);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
// Runtime decode only needs the wasm wrapper + wasm (and JS fallback); skip the encoder.
for (const file of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
  cpSync(resolve(src, file), resolve(dest, file));
  console.log(`[copy-decoders] ${file}`);
}
console.log(`[copy-decoders] → ${dest}`);
