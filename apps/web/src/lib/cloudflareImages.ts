// Cloudflare Images — uploads images by URL and returns the canonical
// CDN delivery URL. Variants (720, 1080, 1440) are configured on the
// Cloudflare side; the delivery URL ends with /<variant-name>.
//
// Activation: set CF_IMAGES_ACCOUNT_ID + CF_IMAGES_API_TOKEN in env.
// When not configured, isConfigured() returns false and callers should
// fall back to the source URL.

type CloudflareUploadResponse = {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  result?: {
    id: string;
    variants?: string[];
  };
};

export function isConfigured(): boolean {
  return Boolean(process.env.CF_IMAGES_ACCOUNT_ID && process.env.CF_IMAGES_API_TOKEN);
}

export type CloudflareUploadResult = {
  // Cloudflare Images IDs are paths like "knowra/<uuid>"; we use them as
  // a stable handle. The delivery URLs are typically returned in `variants`.
  id: string;
  variantUrls: string[];
};

/**
 * Upload an image to Cloudflare Images by source URL. Returns null on
 * failure or when CF isn't configured. Failure is intentionally silent —
 * the caller should fall back to the source URL.
 */
export async function uploadImageByUrl(
  sourceUrl: string,
  metadata: Record<string, string> = {},
): Promise<CloudflareUploadResult | null> {
  if (!isConfigured()) return null;

  const accountId = process.env.CF_IMAGES_ACCOUNT_ID!;
  const token = process.env.CF_IMAGES_API_TOKEN!;

  const form = new FormData();
  form.append('url', sourceUrl);
  if (Object.keys(metadata).length > 0) {
    form.append('metadata', JSON.stringify(metadata));
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as CloudflareUploadResponse;
    if (!json.success || !json.result) return null;
    return {
      id: json.result.id,
      variantUrls: json.result.variants ?? [],
    };
  } catch {
    return null;
  }
}

// Variant URLs come back like ".../public" — pick by suffix.
export function pickVariant(variants: string[], width: 720 | 1080 | 1440): string | null {
  const suffix = `/w${width}`;
  return variants.find((v) => v.endsWith(suffix)) ?? variants[0] ?? null;
}
