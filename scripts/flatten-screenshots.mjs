// Strip alpha channels from App Store screenshots — App Store Connect
// rejects PNGs with transparency. Outputs flattened copies in a `flat/`
// subfolder next to the originals, so the source files stay untouched.
//
// Run from the repo root:
//   pnpm --filter @knowra/web exec node ../../scripts/flatten-screenshots.mjs "C:\path\to\screenshots"
//
// Output: every PNG/JPG in the input dir written to <input>/flat/<name>.jpg

import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const input = process.argv[2];
if (!input) {
  console.error('Usage: node flatten-screenshots.mjs <folder>');
  process.exit(1);
}

const outDir = path.join(input, 'flat');
await fs.mkdir(outDir, { recursive: true });

const files = (await fs.readdir(input)).filter((f) => /\.(png|jpe?g)$/i.test(f));

if (files.length === 0) {
  console.error(`No images found in ${input}`);
  process.exit(1);
}

console.log(`Processing ${files.length} image(s) → ${outDir}`);

for (const f of files) {
  const src = path.join(input, f);
  const base = f.replace(/\.(png|jpe?g)$/i, '');
  const dst = path.join(outDir, `${base}.jpg`);
  // JPEG quality 92 — visually lossless, ~70% smaller than PNG.
  // .flatten() composites against the given background, eliminating alpha.
  await sharp(src).flatten({ background: '#000000' }).jpeg({ quality: 92 }).toFile(dst);
  console.log(`  ${f} → ${path.basename(dst)}`);
}

console.log(`\n✓ Done. Upload the files from:\n  ${outDir}`);
