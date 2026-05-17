import { NextResponse } from 'next/server';
import { isConfigured, uploadImageByUrl } from '@/lib/cloudflareImages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One-shot CF Images smoke test. Confirms env vars are loaded and that
// upload-by-URL actually works with the configured token + account.
// REMOVE BEFORE PRODUCTION — no auth.
export async function GET() {
  const accountId = process.env.CF_IMAGES_ACCOUNT_ID;
  const token = process.env.CF_IMAGES_API_TOKEN;

  const env = {
    isConfigured: isConfigured(),
    hasAccountId: Boolean(accountId),
    accountIdPrefix: accountId?.slice(0, 8) ?? null,
    hasToken: Boolean(token),
    tokenPrefix: token?.slice(0, 8) ?? null,
  };

  if (!isConfigured()) {
    return NextResponse.json({ env, result: 'CF_NOT_CONFIGURED' });
  }

  // Use a tiny known-good Wikipedia image as the upload source.
  const testUrl =
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/PNG_transparency_demonstration_1.png/120px-PNG_transparency_demonstration_1.png';
  const upload = await uploadImageByUrl(testUrl, { source: 'cf-debug-endpoint' });

  return NextResponse.json({ env, testUrl, upload });
}
