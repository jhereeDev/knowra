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
const playStoreIcon = path.join(assets, 'play-store-icon.png');

await Promise.all([
  sharp(source).resize(1024, 1024).flatten({ background: '#000000' }).png().toFile(iosIcon),
  sharp(source).resize(1024, 1024).flatten({ background: '#05071a' }).png().toFile(androidIcon),
  // Play Store listing icon — separate from the launcher icon baked
  // into the AAB. Google requires 512×512 PNG/JPEG, ≤1 MB. Brand
  // background, not pure black, so it pops against Play's UI.
  sharp(source).resize(512, 512).flatten({ background: '#05071a' }).png().toFile(playStoreIcon),
]);

console.log(`✓ ${iosIcon} (1024×1024, opaque black)`);
console.log(`✓ ${androidIcon} (1024×1024, opaque #05071a)`);
console.log(`✓ ${playStoreIcon} (512×512, opaque #05071a — upload to Play Console store listing)`);
