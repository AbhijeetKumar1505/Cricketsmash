// Compress all GLB assets (characters + bonus props) with Draco geometry + WebP
// textures, in place. Pristine originals are copied to asset-backups/glb-raw/ on
// first run and are ALWAYS used as the compression source, so re-running never
// double-compresses (which would degrade quality).
//
//   node tools/compress-glb.mjs            # compress everything
//   node tools/compress-glb.mjs --restore  # restore originals from backup
//
// Rig safety: --simplify/--join/--flatten/--instance/--palette are all disabled so
// the Meshy 24-bone skinned rigs (mesh + skeleton + animation clip names) survive
// untouched. Draco forces vertex welding (identical verts only) — verified safe.
// See feedback.md before changing these flags.
import { cpSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backupRoot = resolve(root, 'asset-backups/glb-raw');
const TARGET_DIRS = [
  'apps/frontend/public/players',
  'apps/frontend/public/rigs',
].map((d) => resolve(root, d));

const OPTIMIZE_ARGS = [
  '--compress', 'draco',
  '--texture-compress', 'webp',
  '--texture-size', '2048',
  '--simplify', 'false',
  '--join', 'false',
  '--flatten', 'false',
  '--instance', 'false',
  '--palette', 'false',
];

// Invoke the CLI's JS entry directly with the current node — avoids the Windows
// "spawnSync .cmd EINVAL" issue (Node refuses to spawn .cmd without shell:true).
const gltfCli = resolve(root, 'node_modules/@gltf-transform/cli/bin/cli.js');

function walkGlb(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkGlb(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) out.push(full);
  }
  return out;
}

const mb = (p) => (statSync(p).size / 1048576).toFixed(2);
const restore = process.argv.includes('--restore');

const files = TARGET_DIRS.flatMap(walkGlb);
if (files.length === 0) {
  console.error('[compress-glb] No .glb files found under target dirs.');
  process.exit(1);
}

let before = 0, after = 0;
for (const live of files) {
  const rel = relative(root, live);
  const backup = join(backupRoot, rel);

  if (restore) {
    if (existsSync(backup)) { cpSync(backup, live); console.log(`[restore] ${rel}`); }
    else console.warn(`[restore] no backup for ${rel}`);
    continue;
  }

  // First run for this file: snapshot the pristine original.
  if (!existsSync(backup)) {
    mkdirSync(dirname(backup), { recursive: true });
    cpSync(live, backup);
  }

  const srcMb = +mb(backup);
  before += srcMb;
  try {
    execFileSync(process.execPath, [gltfCli, 'optimize', backup, live, ...OPTIMIZE_ARGS], { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch (e) {
    console.error(`[compress-glb] FAILED ${rel}: ${e.message}`);
    process.exitCode = 1;
    continue;
  }
  const dstMb = +mb(live);
  after += dstMb;
  console.log(`[ok] ${rel}  ${srcMb} MB → ${dstMb} MB`);
}

if (!restore) {
  console.log(`\n[compress-glb] total ${before.toFixed(1)} MB → ${after.toFixed(1)} MB ` +
    `(${(100 * (1 - after / before)).toFixed(0)}% smaller, ${files.length} files)`);
}
