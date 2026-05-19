import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { Feather as RawFeather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  pauseAudio,
  resumeAudio,
  stopAudio,
  useAudioState,
} from '@/lib/audio';

type FeatherIconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};
const Feather = RawFeather as unknown as React.ComponentType<FeatherIconProps>;

// Floating mini player. Renders nothing when audio is idle; slides in
// when the user taps "Listen" on a card. Tap the player to expand
// (later — not in this MVP). Bottom-anchored above the home indicator,
// designed to not occlude the card content underneath.
//
// Placed once at the root of the feed (FeedScreen), it persists across
// card swipes — playback continues as the user keeps scrolling. The
// "stop" button (X) clears the player and removes the bar.
export function MiniAudioPlayer() {
  const audio = useAudioState();
  const insets = useSafeAreaInsets();

  // Hide entirely when idle. We don't want a "play" button hanging
  // around — the entry point is the Listen action on each card.
  if (audio.status === 'idle' || !audio.card) return null;

  const card = audio.card;
  const isLoading = audio.status === 'loading';
  const isPlaying = audio.status === 'playing';
  const isError = audio.status === 'error';

  // Progress 0..1 (clamped). When duration is unknown, treat as 0 so
  // the bar doesn't flicker.
  const progress =
    audio.durationMs > 0
      ? Math.max(0, Math.min(1, audio.positionMs / audio.durationMs))
      : 0;

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0"
      style={{ bottom: insets.bottom + 76 }}
    >
      <View className="mx-3 overflow-hidden rounded-2xl border border-knowverse-star/15 bg-knowverse/95 shadow-2xl">
        {/* Progress sliver at the very top of the pill. */}
        <View className="h-0.5 bg-knowverse-star/10">
          <View
            className="bg-knowverse-star h-full"
            style={{ width: `${progress * 100}%` }}
          />
        </View>

        <View className="flex-row items-center gap-3 px-3 py-2.5">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-knowverse-star/15">
            {isLoading ? (
              <ActivityIndicator color="#e7e9ff" size="small" />
            ) : isError ? (
              <Feather name="alert-circle" size={16} color="#fca5a5" />
            ) : (
              <Feather name="headphones" size={16} color="#e7e9ff" />
            )}
          </View>

          <View className="flex-1">
            <Text
              className="text-knowverse-star text-sm font-medium"
              numberOfLines={1}
            >
              {card.title}
            </Text>
            <Text
              className="text-knowverse-star/55 mt-0.5 text-xs"
              numberOfLines={1}
            >
              {isError
                ? (audio.errorMessage ?? 'Playback failed')
                : isLoading
                ? 'Preparing audio…'
                : formatTime(audio.positionMs, audio.durationMs)}
            </Text>
          </View>

          {!isError && !isLoading && (
            <Pressable
              onPress={() => (isPlaying ? pauseAudio() : resumeAudio())}
              accessibilityLabel={isPlaying ? 'Pause narration' : 'Resume narration'}
              className="h-9 w-9 items-center justify-center rounded-full bg-knowverse-star/15"
            >
              <Feather name={isPlaying ? 'pause' : 'play'} size={16} color="#e7e9ff" />
            </Pressable>
          )}

          <Pressable
            onPress={() => stopAudio()}
            accessibilityLabel="Stop narration"
            className="h-9 w-9 items-center justify-center rounded-full"
          >
            <Feather name="x" size={16} color="#e7e9ff99" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function formatTime(positionMs: number, durationMs: number): string {
  const pos = Math.max(0, Math.floor(positionMs / 1000));
  const dur = durationMs > 0 ? Math.floor(durationMs / 1000) : 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return dur > 0 ? `${fmt(pos)} / ${fmt(dur)}` : fmt(pos);
}
