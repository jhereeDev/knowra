import Anthropic from '@anthropic-ai/sdk';

// 300-word "if you only read one thing" summary for the Go-deeper reader.
// Same smart-friend voice as hooks.ts, longer canvas. Three short paragraphs.
//
// Cost shape (Haiku 4.5): ~700 input + ~450 output tokens per call →
// roughly $0.002 per article. Generated lazily on first reader open and
// persisted to articles.summary, so each article is paid for at most once.
//
// Prompt-caching note: same situation as hooks.ts — system prompt is well
// under Haiku 4.5's 4096-token cache minimum, so cache_control markers
// would be silent no-ops. If the prompt grows past 4096 tokens (e.g. with
// few-shot examples), one marker on the system block delivers ~90% input-
// cost reduction.
const SYSTEM_PROMPT = `You write 300-word "if you only read one thing" summaries for Knowra, a TikTok-style feed of Wikipedia articles. Your job: turn a Wikipedia article into a tight, vivid summary that delivers the substance someone needs to feel they've actually learned the thing.

Structure — exactly three short paragraphs:
1. Lead with the most interesting, specific, or human detail. The thing a friend would actually open with.
2. Give the context: who, when, where, why it exists, how it works at a high level.
3. End with what's unresolved, surprising, or why it still matters today.

Rules:
- ~300 words total. Hard maximum 380 words.
- Smart-friend tone: confident, curious, never smug, never clickbait.
- No filler openers ("Did you know...", "Interestingly...", "It's worth noting...").
- No hedging ("might be", "is considered to be"). State things directly.
- No emoji. No exclamation marks unless the topic genuinely warrants one.
- No headings, no bullet lists, no markdown. Plain prose paragraphs separated by one blank line.
- Do not invent facts not present in the source. If the source is thin, say less rather than padding.
- Only output NO_SUMMARY in the rare case the source is fully empty (no facts at all).

Output only the summary text. No preamble, no quotes, no markdown.`;

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 800; // ~600 words of headroom; we clamp below at 380 words.
const HARD_WORD_CEILING = 420; // reject runaway output beyond a hair past the limit
const NO_SUMMARY_SENTINEL = 'NO_SUMMARY';

let _client: Anthropic | undefined;
function getClient(): Anthropic {
  _client ??= new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return _client;
}

export type SummaryResult =
  | { kind: 'ok'; summary: string }
  | { kind: 'no_summary' } // model judged the source too thin
  | { kind: 'error'; message: string };

/**
 * Generate a ~300-word, three-paragraph summary of a Wikipedia article.
 * Never throws — returns a discriminated result so callers can distinguish
 * "model said no" from "generation failed". Same pattern as generateHook().
 */
export async function generateSummary(
  title: string,
  extract: string,
): Promise<SummaryResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { kind: 'error', message: 'ANTHROPIC_API_KEY not set' };
  }
  if (!extract.trim()) {
    return { kind: 'no_summary' };
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
          content: `Title: ${title}\nSource:\n${extract}\n\nSummary:`,
        },
      ],
    });

    const textBlock = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (!textBlock) return { kind: 'error', message: 'no text block in response' };

    const raw = textBlock.text.trim();
    if (!raw || raw === NO_SUMMARY_SENTINEL) return { kind: 'no_summary' };

    // Defensive: cap word count even if the model overshoots.
    const wordCount = raw.split(/\s+/).length;
    if (wordCount > HARD_WORD_CEILING) {
      return { kind: 'no_summary' };
    }

    return { kind: 'ok', summary: raw };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return { kind: 'error', message: `${err.status ?? '?'}: ${err.message}` };
    }
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
