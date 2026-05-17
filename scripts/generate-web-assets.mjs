// Generates Next.js App Router asset files for SEO + browser chrome.
// Next 15 auto-detects files at app/{favicon,icon,apple-icon,opengraph-image,twitter-image}
// and emits the right <head> tags. No metadata wiring needed — just put
// the files at the right paths.
//
// Run from the repo root:
//   pnpm --filter @knowra/web exec node ../../scripts/generate-web-assets.mjs

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const mobileAssets = path.join(repoRoot, 'apps', 'mobile', 'assets');
const appDir = path.join(repoRoot, 'apps', 'web', 'src', 'app');

const source = path.join(mobileAssets, 'splash-icon.png');
const existingFavicon = path.join(mobileAssets, 'favicon.ico');

// Copy the .ico if it's there — Next can't generate .ico from sharp.
try {
  await fs.copyFile(existingFavicon, path.join(appDir, 'favicon.ico'));
  console.log(`✓ favicon.ico copied`);
} catch {
  console.log(`(no existing favicon.ico found in mobile assets — Next will fall back to icon.png)`);
}

// app/icon.png — browser tab icon. 32×32 is what browsers actually
// render in the tab; bigger sizes are derived. Dark-background variant
// so it stays visible on white search results.
await sharp(source)
  .resize(32, 32)
  .flatten({ background: '#05071a' })
  .png()
  .toFile(path.join(appDir, 'icon.png'));
console.log(`✓ icon.png (32×32)`);

// app/apple-icon.png — iOS Safari home-screen icon. 180×180 is the
// modern reference size.
await sharp(source)
  .resize(180, 180)
  .flatten({ background: '#05071a' })
  .png()
  .toFile(path.join(appDir, 'apple-icon.png'));
console.log(`✓ apple-icon.png (180×180)`);

// app/opengraph-image.png — preview when knowra.space is shared on
// Facebook / Slack / iMessage / LinkedIn. 1200×630 is the canonical
// 1.91:1 OG aspect ratio; Twitter also accepts it.
const OG_W = 1200;
const OG_H = 630;
const LOGO = 360;
const LOGO_X = 110;
const LOGO_Y = (OG_H - LOGO) / 2;

const ogBg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">
  <defs>
    <radialGradient id="bg" cx="30%" cy="50%" r="90%">
      <stop offset="0%" stop-color="#0a0e27"/>
      <stop offset="100%" stop-color="#05071a"/>
    </radialGradient>
  </defs>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#bg)"/>
  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fill="#e7e9ff">
    <text x="580" y="280" font-size="108" font-weight="700" letter-spacing="-2">Knowra</text>
    <text x="580" y="340" font-size="34" font-weight="500" fill="rgba(231,233,255,0.78)">Expand your Knowra.</text>
    <text x="580" y="400" font-size="24" fill="rgba(231,233,255,0.48)">The Wikipedia curiosity feed —</text>
    <text x="580" y="436" font-size="24" fill="rgba(231,233,255,0.48)">beautifully presented, one swipe away.</text>
  </g>
</svg>`;

const logo = await sharp(source).resize(LOGO, LOGO).png().toBuffer();

const ogBuffer = await sharp(Buffer.from(ogBg))
  .composite([{ input: logo, left: LOGO_X, top: LOGO_Y }])
  .png()
  .toBuffer();

await fs.writeFile(path.join(appDir, 'opengraph-image.png'), ogBuffer);
console.log(`✓ opengraph-image.png (1200×630)`);

// Twitter uses the same image — could differ, but for v1 ship a single
// matching graphic.
await fs.writeFile(path.join(appDir, 'twitter-image.png'), ogBuffer);
console.log(`✓ twitter-image.png (1200×630)`);

console.log(`\nNext.js will auto-emit favicon + icon + og tags on every page.`);
