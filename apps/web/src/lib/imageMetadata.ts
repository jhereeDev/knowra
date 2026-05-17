import sharp from 'sharp';
import { encode as encodeBlurhash } from 'blurhash';

const FETCH_TIMEOUT_MS = 4000;

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

async function fetchImageBuffer(imageUrl: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          process.env.WIKIPEDIA_USER_AGENT ??
          'Knowra/0.1 (contact: dev@knowra.space)',
      },
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Download an image and extract its dominant color as a #rrggbb hex string.
 * Returns null on any failure — callers should treat the color as optional
 * since image extraction is best-effort and shouldn't block card delivery.
 *
 * Implementation note: sharp's `.stats()` returns a `dominant` field for
 * the image's most common color via k-means. We resize to 64px first so
 * the computation is fast (~20–60ms) even on large Wikipedia originals.
 */
export async function extractDominantColor(imageUrl: string): Promise<string | null> {
  const buf = await fetchImageBuffer(imageUrl);
  if (!buf) return null;
  try {
    const stats = await sharp(buf)
      .resize(64, 64, { fit: 'inside', withoutEnlargement: true })
      .stats();
    const { r, g, b } = stats.dominant;
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return null;
  }
}

/**
 * Extract BOTH the dominant color and a blurhash placeholder in a single
 * image fetch + sharp pipeline. Heavier than extractDominantColor alone
 * (one extra raw-buffer decode), but a single network round-trip is much
 * cheaper than two. Returns nulls for whichever piece failed.
 */
export async function extractImageMetadata(imageUrl: string): Promise<{
  dominantColor: string | null;
  blurhash: string | null;
}> {
  const buf = await fetchImageBuffer(imageUrl);
  if (!buf) return { dominantColor: null, blurhash: null };

  const result: { dominantColor: string | null; blurhash: string | null } = {
    dominantColor: null,
    blurhash: null,
  };

  // Dominant color
  try {
    const stats = await sharp(buf)
      .resize(64, 64, { fit: 'inside', withoutEnlargement: true })
      .stats();
    const { r, g, b } = stats.dominant;
    result.dominantColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    /* leave null */
  }

  // Blurhash — needs a tiny RGBA buffer. 32×32 with 4×4 components is
  // the standard blurhash recommendation; produces ~30-char strings.
  try {
    const { data, info } = await sharp(buf)
      .resize(32, 32, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    result.blurhash = encodeBlurhash(new Uint8ClampedArray(data), info.width, info.height, 4, 4);
  } catch {
    /* leave null */
  }

  return result;
}
