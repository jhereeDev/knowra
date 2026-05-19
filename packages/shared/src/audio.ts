import { z } from 'zod';

// Result of asking the backend to narrate an article. The audio file
// itself is served separately via /api/audio/file/[wikiId]; this
// payload tells the client where to find it and how long it'll run.

export const generateAudioResponseSchema = z.object({
  // Relative URL the mobile app appends to EXPO_PUBLIC_API_URL.
  url: z.string(),
  // Best-effort approximate duration; -1 if unknown.
  durationMs: z.number().int(),
  // True when this request returned an already-cached file (no LLM/TTS
  // spend). Useful for telemetry; not user-facing.
  cached: z.boolean(),
});
export type GenerateAudioResponse = z.infer<typeof generateAudioResponseSchema>;
