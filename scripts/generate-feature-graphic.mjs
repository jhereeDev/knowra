// Generates the Google Play Store feature graphic (1024×500 PNG).
// Brain logo on the left, brand text on the right, dark space gradient
// background — matches the in-app aesthetic.
//
// Run from the repo root:
//   pnpm --filter @knowra/web exec node ../../scripts/generate-feature-graphic.mjs

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const assets = path.join(repoRoot, 'apps', 'mobile', 'assets');

const source = path.join(assets, 'splash-icon.png');
const out = path.join(assets, 'play-feature-graphic.png');

const W = 1024;
const H = 500;
const LOGO = 340; // brain logo size
const LOGO_X = 110;
const LOGO_Y = (H - LOGO) / 2;

// Background: radial gradient + brand text, rendered via SVG. Web-safe
// fonts only — Play renders the graphic as a raster, so whatever font
// the SVG resolver uses on the build machine is baked in. Stick to
// sans-serif fallbacks.
const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="bg" cx="35%" cy="50%" r="85%">
      <stop offset="0%" stop-color="#0a0e27"/>
      <stop offset="100%" stop-color="#05071a"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fill="#e7e9ff">
    <text x="560" y="220" font-size="96" font-weight="700" letter-spacing="-2">Knowra</text>
    <text x="560" y="278" font-size="30" font-weight="500" fill="rgba(231,233,255,0.78)">Expand your Knowra.</text>
    <text x="560" y="330" font-size="22" fill="rgba(231,233,255,0.48)">The Wikipedia curiosity feed —</text>
    <text x="560" y="362" font-size="22" fill="rgba(231,233,255,0.48)">a swipe away.</text>
  </g>
</svg>`;

const logo = await sharp(source).resize(LOGO, LOGO).png().toBuffer();

await sharp(Buffer.from(bgSvg))
  .composite([{ input: logo, left: LOGO_X, top: LOGO_Y }])
  .png()
  .toFile(out);

console.log(`✓ ${out} (1024×500 PNG — upload to Play Console store listing)`);
