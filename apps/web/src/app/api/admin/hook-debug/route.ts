import { NextResponse } from 'next/server';
import { generateHook } from '@/lib/hooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One-shot debug endpoint. Calls generateHook with a tiny fixed example
// and returns the result so we can see exactly what's failing.
// REMOVE BEFORE PRODUCTION — no auth, exposes generation errors verbatim.
export async function GET() {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const keyPrefix = process.env.ANTHROPIC_API_KEY?.slice(0, 8) ?? null;
  const result = await generateHook(
    'Pyrausta castalis',
    'Pyrausta castalis is a species of moth in the family Crambidae. It is found in Russia, the Czech Republic, the Balkan Peninsula, Italy, France and Spain.',
  );
  return NextResponse.json({
    env: { hasAnthropicKey: hasKey, keyPrefix },
    result,
  });
}
