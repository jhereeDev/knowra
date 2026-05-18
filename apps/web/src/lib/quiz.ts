import Anthropic from '@anthropic-ai/sdk';
import { quizQuestionSchema, type QuizQuestion } from '@knowra/shared';

// One MCQ per article. The model is asked to produce strict JSON; we
// validate with the shared zod schema and fail-soft on any parse error
// (caller treats it as no-quiz-available, which is the right default —
// we never want a broken quiz blocking the feed).
const SYSTEM_PROMPT = `You write quiz questions for Knowra, a Wikipedia knowledge app. Given an article's title, hook, and extract, produce ONE multiple-choice question that tests genuine recall of a substantive, factual detail from the source.

Rules:
- The question is short (1 sentence, max 180 chars).
- Exactly 4 options. Plausible distractors that someone who only skimmed the article would consider. Avoid "all of the above" / "none of the above". Avoid obvious throwaway wrong answers.
- The correct answer must be directly supported by the supplied text. Do not introduce facts not present in the source.
- Explanation is 1-2 sentences (max 400 chars), pointing to the specific detail in the source that justifies the right answer.
- Skip filler: no "According to the article...", no "Based on the text...". State the question directly.
- Smart-friend tone. Never smug, never trivia-show-host.

Output a single JSON object — no preamble, no code fences, no markdown:
{"question":"…","options":["…","…","…","…"],"correctIndex":0,"explanation":"…"}

correctIndex is 0–3 indexing into options.`;

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 600;

let _client: Anthropic | undefined;
function getClient(): Anthropic {
  _client ??= new Anthropic();
  return _client;
}

export type QuizResult =
  | { kind: 'ok'; quiz: QuizQuestion }
  | { kind: 'error'; message: string };

/**
 * Generate a single MCQ from an article's title + hook + extract.
 * Never throws. Returns a discriminated result so callers can fail-soft.
 */
export async function generateQuiz(
  title: string,
  hook: string,
  extract: string,
): Promise<QuizResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { kind: 'error', message: 'ANTHROPIC_API_KEY not set' };
  }
  const source = extract?.trim() || hook?.trim();
  if (!source) {
    return { kind: 'error', message: 'empty source' };
  }

  try {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Title: ${title}\nHook: ${hook}\nExtract: ${source}\n\nQuiz JSON:`,
        },
      ],
    });

    const textBlock = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (!textBlock) return { kind: 'error', message: 'no text block in response' };

    // Strip any accidental code-fence wrappers — the model sometimes
    // ignores the no-markdown instruction.
    let raw = textBlock.text.trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*/, '').replace(/```$/, '').trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { kind: 'error', message: 'non-JSON output' };
    }

    const validated = quizQuestionSchema.safeParse(parsed);
    if (!validated.success) {
      return { kind: 'error', message: validated.error.message };
    }
    return { kind: 'ok', quiz: validated.data };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return { kind: 'error', message: `${err.status ?? '?'}: ${err.message}` };
    }
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
