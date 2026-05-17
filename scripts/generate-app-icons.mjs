// Regenerates the mobile app icon + Android adaptive icon from the
// high-res splash artwork. iOS app icons must be opaque 1024×1024;
// Android adaptive icon foreground is composed over the backgroundColor
// declared in app.json (#05071a).
//
// Run from the repo root:
//   pnpm --filter @knowra/web exec node ../../scripts/generate-app-icons.mjs

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const assets = path.join(repoRoot, 'apps', 'mobile', 'assets');

const source = path.join(assets, 'splash-icon.png');
const iosIcon = path.join(assets, 'icon.png');
const androidIcon = path.join(assets, 'adaptive-icon.png');

await Promise.all([
  sharp(source).resize(1024, 1024).flatten({ background: '#000000' }).png().toFile(iosIcon),
  sharp(source).resize(1024, 1024).flatten({ background: '#05071a' }).png().toFile(androidIcon),
]);

console.log(`✓ ${iosIcon} (1024×1024, opaque black)`);
console.log(`✓ ${androidIcon} (1024×1024, opaque #05071a)`);
