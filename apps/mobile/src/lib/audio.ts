import { useEffect, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { generateAudioResponseSchema, type Card } from '@knowra/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Feature flag — flip to true once the VPS audio pipeline is verified
// (cache dir provisioned, OPENAI_API_KEY set, 502s gone). When false,
// the Listen button and the mini player are hidden so the feature is
// fully invisible to the user. Keeps the audio module compiled so
// re-enabling is a one-line change.
export const AUDIO_ENABLED = false;

// Singleton audio controller for Knowra. Only one card narrates at a
// time; starting playback on a different card replaces the previous
// player. Subscribers (the mini player, the Listen button) read the
// current state via the `useAudioState` hook.
//
// We don't pre-generate audio — the file is created on first tap. That
// keeps spend bounded ($0.0075/article on OpenAI tts-1) and avoids
// generating narration for articles the user never wants to hear.

export type AudioState = {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  // Article currently loaded into the player (or last attempted on error).
  card: Card | null;
  // Position / duration in milliseconds. -1 when unknown.
  positionMs: number;
  durationMs: number;
  errorMessage: string | null;
};

const INITIAL: AudioState = {
  status: 'idle',
  card: null,
  positionMs: 0,
  durationMs: -1,
  errorMessage: null,
};

let state: AudioState = { ...INITIAL };
let player: AudioPlayer | null = null;
let progressTimer: ReturnType<typeof setInterval> | null = null;
let audioModeConfigured = false;
const subscribers = new Set<(s: AudioState) => void>();

function notify(): void {
  for (const sub of subscribers) sub(state);
}

function setState(patch: Partial<AudioState>): void {
  state = { ...state, ...patch };
  notify();
}

async function ensureAudioMode(): Promise<void> {
  if (audioModeConfigured) return;
  // Allow playback when the silent switch is on AND while the app is
  // backgrounded. Required for the "listen while commuting" use case.
  // Failures are tolerated — older Expo Go runtimes raise here, and
  // the rest of the pipeline still works (just without background).
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    });
    audioModeConfigured = true;
  } catch {
    /* tolerate */
  }
}

function disposePlayer(): void {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch {
      /* tolerate */
    }
    player = null;
  }
}

function startProgressTimer(): void {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (!player) return;
    try {
      const pos = Math.round(player.currentTime * 1000);
      const dur = player.duration > 0 ? Math.round(player.duration * 1000) : state.durationMs;
      if (pos !== state.positionMs || dur !== state.durationMs) {
        setState({ positionMs: pos, durationMs: dur });
      }
      // Auto-stop at end of track. expo-audio doesn't fire a clean
      // "didJustFinish" callback in every version, so we detect via
      // position approaching duration.
      if (dur > 0 && pos >= dur - 250 && state.status === 'playing') {
        disposePlayer();
        setState({ status: 'idle', positionMs: 0 });
      }
    } catch {
      /* tolerate */
    }
  }, 500);
}

/**
 * Start playback of the given card. Tears down any previous player.
 * Idempotent for the same card — calling twice while playing is a
 * no-op; calling while paused resumes.
 */
export async function playCard(card: Card): Promise<void> {
  if (state.card?.articleId === card.articleId) {
    if (state.status === 'paused') {
      player?.play();
      setState({ status: 'playing' });
      return;
    }
    if (state.status === 'playing') return;
  }

  disposePlayer();
  setState({ status: 'loading', card, positionMs: 0, durationMs: -1, errorMessage: null });
  await ensureAudioMode();

  try {
    // Generate (or fetch cached) audio on the backend. Returns the
    // streaming URL we hand to expo-audio.
    const res = await fetch(`${API_URL}/api/audio/${encodeURIComponent(card.wikiId)}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${body.slice(0, 120)}`);
    }
    const json = generateAudioResponseSchema.parse(await res.json());
    const fullUrl = `${API_URL}${json.url}`;

    player = createAudioPlayer({ uri: fullUrl });
    player.play();
    setState({
      status: 'playing',
      durationMs: json.durationMs,
    });
    startProgressTimer();
  } catch (err) {
    disposePlayer();
    setState({
      status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

export function pauseAudio(): void {
  if (state.status !== 'playing' || !player) return;
  try {
    player.pause();
    setState({ status: 'paused' });
  } catch {
    /* tolerate */
  }
}

export function resumeAudio(): void {
  if (state.status !== 'paused' || !player) return;
  try {
    player.play();
    setState({ status: 'playing' });
  } catch {
    /* tolerate */
  }
}

export function stopAudio(): void {
  disposePlayer();
  setState({ ...INITIAL });
}

export function getAudioState(): AudioState {
  return state;
}

export function useAudioState(): AudioState {
  const [s, setS] = useState<AudioState>(() => state);
  useEffect(() => {
    const sub = (next: AudioState) => setS(next);
    subscribers.add(sub);
    setS(state); // re-sync on mount in case state changed before subscribe
    return () => {
      subscribers.delete(sub);
    };
  }, []);
  return s;
}
