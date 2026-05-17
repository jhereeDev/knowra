import Anthropic from '@anthropic-ai/sdk';

// Smart-friend tone, hard length cap, explicit refusal sentinel. Iterate
// this prompt to tune voice — every byte change here invalidates any
// prompt cache, but at ~200 tokens we're below Haiku 4.5's 4096-token
// cache minimum anyway, so no cache_control markers below. If the prompt
// grows past 4096 tokens (e.g. with few-shot examples), add cache_control
// on the system block for a ~90% input-cost reduction.
const SYSTEM_PROMPT = `You write hooks for Knowra, a TikTok-style feed of Wikipedia articles. Your job: turn a Wikipedia summary into a 1-2 sentence hook that makes someone want to read more.

Always write a hook. Even mundane subjects have one interesting angle — find it and lead with it.

Rules:
- 1-2 sentences. Maximum 240 characters total.
- Lead with the most surprising, vivid, specific, or human detail in the source. If the source mentions a date, place, number, or relationship, prefer that over the generic opener.
- Smart-friend tone: confident and curious. Never clickbait, never smug.
- No filler openers ("Did you know...", "Interestingly...", "It's worth noting..."). Start with the substance.
- No hedging ("might be", "is considered to be"). State things directly.
- No emoji. No exclamation marks unless the topic genuinely warrants one.
- Only output NO_HOOK in the rare case the source is fully empty (no facts at all) — not just dry or list-like.

Examples:
Title: Ann Walsh
Source: Ann Walsh is a visual artist, primarily working with paint, Plexiglas and vinyl. Her work has been displayed in The Everson Museum of Art, the Portland Museum of Art, the Saint-Gaudens National Historic Site and the Lori Bookstein Gallery.
Hook: Ann Walsh paints on Plexiglas — and her translucent panels have hung in five museums most painters never reach in a lifetime.

Title: Pyrausta castalis
Source: Pyrausta castalis is a species of moth in the family Crambidae. It is found in Russia, the Czech Republic, the Balkan Peninsula, Italy, France and Spain.
Hook: A moth named Pyrausta castalis somehow lives across most of Europe and as far east as Russia, but no one has bothered to give it a common name.

Output only the hook text. No quotes, no markdown, no preamble.`;

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 256;
const HARD_LENGTH_CEILING = 280; // a touch over the 240 target; reject runaway output
const NO_HOOK_SENTINEL = 'NO_HOOK';

let _client: Anthropic | undefined;
function getClient(): Anthropic {
  _client ??= new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return _client;
}

export type HookResult =
  | { kind: 'ok'; hook: string }
  | { kind: 'no_hook' } // model judged the source too thin
  | { kind: 'error'; message: string };

/**
 * Generate a 1-2 sentence hook for a Wikipedia article. Fire-and-forget
 * safe — never throws. Returns a discriminated result so callers can
 * distinguish "model said no" from "generation failed".
 */
export async function generateHook(title: string, extract: string): Promise<HookResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { kind: 'error', message: 'ANTHROPIC_API_KEY not set' };
  }
  if (!extract.trim()) {
    return { kind: 'no_hook' };
  }

  try {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'disabled' }, // text transform — no reasoning needed
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Title: ${title}\nSource: ${extract}\n\nHook:`,
        },
      ],
    });

    const textBlock = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (!textBlock) return { kind: 'error', message: 'no text block in response' };

    const raw = textBlock.text.trim();
    if (!raw || raw === NO_HOOK_SENTINEL) return { kind: 'no_hook' };
    if (raw.length > HARD_LENGTH_CEILING) {
      // Don't ship a 600-character "hook" even if the model produces one.
      return { kind: 'no_hook' };
    }
    return { kind: 'ok', hook: raw };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return { kind: 'error', message: `${err.status ?? '?'}: ${err.message}` };
    }
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
