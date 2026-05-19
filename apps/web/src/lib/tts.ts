import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Generate (or fetch from disk cache) an MP3 narration of an article.
// Backed by OpenAI's tts-1 model — cheaper than ElevenLabs at quality
// good enough for spoken summaries (~$15 per 1M characters). For a
// typical Knowra article snippet of ~500 chars, that's $0.0075 per
// generation. We cache forever on disk, keyed by article id + a hash
// of the text — text drift (e.g. LLM hook regeneration) gets a fresh
// audio file rather than a stale one. Old files age out via deploy
// hygiene, not LRU.

const CACHE_DIR = process.env.TTS_CACHE_DIR ?? '/var/lib/knowra/audio';
const MODEL = 'tts-1';
const VOICE = 'alloy';
const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
// Hard length ceiling — OpenAI accepts up to 4096 chars. We pass less
// because a card hook + 300-word summary is ~1800 chars and any more
// gets unpleasantly long-form for a swipe feed.
const MAX_INPUT_CHARS = 2400;

export type TtsResult =
  | { kind: 'ok'; filePath: string; cached: boolean; bytes: number }
  | { kind: 'error'; message: string };

function cacheKey(wikiId: string, text: string): string {
  // Combine the wikiId with a short hash of the text so different
  // text bodies for the same article produce different cache files.
  // The wikiId prefix keeps the directory listing intelligible.
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 12);
  return `${wikiId}.${hash}.mp3`;
}

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

/** Returns the absolute path of a cached audio file if it exists. */
export async function findCachedAudio(
  wikiId: string,
  text: string,
): Promise<string | null> {
  await ensureCacheDir();
  const filePath = path.join(CACHE_DIR, cacheKey(wikiId, text));
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

/** Resolve a wikiId to the most recently-modified cached MP3 for that id. */
export async function findAnyCachedForWiki(wikiId: string): Promise<string | null> {
  await ensureCacheDir();
  try {
    const files = await fs.readdir(CACHE_DIR);
    const matches = files.filter((f) => f.startsWith(`${wikiId}.`) && f.endsWith('.mp3'));
    if (matches.length === 0) return null;
    if (matches.length === 1) return path.join(CACHE_DIR, matches[0]!);
    // Multiple candidates — pick the newest by mtime.
    const stats = await Promise.all(
      matches.map(async (f) => {
        const full = path.join(CACHE_DIR, f);
        const stat = await fs.stat(full);
        return { full, mtimeMs: stat.mtimeMs };
      }),
    );
    stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return stats[0]?.full ?? null;
  } catch {
    return null;
  }
}

/**
 * Generate or fetch the cached MP3 for `wikiId` with body `text`.
 * Trims `text` to MAX_INPUT_CHARS to bound spend. Returns the
 * absolute on-disk path the streaming route should serve.
 */
export async function generateAudio(wikiId: string, text: string): Promise<TtsResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { kind: 'error', message: 'OPENAI_API_KEY not set' };
  }
  const trimmed = text.slice(0, MAX_INPUT_CHARS).trim();
  if (!trimmed) {
    return { kind: 'error', message: 'empty text' };
  }

  const existing = await findCachedAudio(wikiId, trimmed);
  if (existing) {
    const stat = await fs.stat(existing);
    return { kind: 'ok', filePath: existing, cached: true, bytes: stat.size };
  }

  let response: Response;
  try {
    response = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        voice: VOICE,
        input: trimmed,
        response_format: 'mp3',
        speed: 1.0,
      }),
    });
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    return {
      kind: 'error',
      message: `OpenAI TTS HTTP ${response.status}: ${body.slice(0, 240)}`,
    };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await ensureCacheDir();
  const filePath = path.join(CACHE_DIR, cacheKey(wikiId, trimmed));
  await fs.writeFile(filePath, buffer);
  return { kind: 'ok', filePath, cached: false, bytes: buffer.byteLength };
}

/**
 * Rough duration estimate (ms). OpenAI's tts-1 doesn't return duration
 * metadata, and we don't ship ffprobe in the runtime. The model speaks
 * at ~150 wpm = 2.5 words/sec; assuming average English word length of
 * 5 chars + 1 space, that's ~15 chars/sec. This is good enough for the
 * mobile UI's "00:00 / 02:14" display before the audio actually loads.
 */
export function estimateDurationMs(text: string): number {
  const charsPerSec = 15;
  return Math.round((text.length / charsPerSec) * 1000);
}
