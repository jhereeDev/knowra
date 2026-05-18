import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { Feather as RawFeather } from '@expo/vector-icons';
import { Image as RawExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { recordAnswer, type QuizRecord } from '@/lib/quizzes';
import { swipeCommit, tapImpact } from '@/lib/haptics';

// React-19 JSX-class shims — recurring pattern.
const Image = RawExpoImage as unknown as React.ComponentType<ExpoImageProps>;
type FeatherIconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};
const Feather = RawFeather as unknown as React.ComponentType<FeatherIconProps>;

type Phase = 'asking' | 'answered';

// In-feed quiz card. Same outer card geometry as CardView but the
// content is question + 4 options + reveal state. The user can swipe
// past unanswered — the underlying VerticalPager handles that — but
// the buttons are the explicit interaction.
export function QuizCardView({ record, onContinue }: {
  record: QuizRecord;
  onContinue: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('asking');
  const [picked, setPicked] = useState<0 | 1 | 2 | 3 | null>(null);

  const onPick = (i: 0 | 1 | 2 | 3) => {
    if (phase === 'answered') return;
    tapImpact();
    setPicked(i);
    setPhase('answered');
    void recordAnswer(record.articleId, i);
  };

  const isCorrect = picked !== null && picked === record.quiz.correctIndex;

  return (
    <View className="flex-1 bg-knowverse-deep">
      {/* Hero thumbnail strip — context for which article this quizzes */}
      {record.card.image && (
        <View
          style={{
            backgroundColor: record.card.image.dominantColor ?? '#0b0e24',
            height: 200,
          }}
        >
          <Image
            source={{ uri: record.card.image.url }}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
            recyclingKey={`quiz-${record.articleId}`}
          />
          <View
            className="absolute inset-0 bg-knowverse-deep/55"
            pointerEvents="none"
          />
        </View>
      )}

      <View
        className="px-6"
        style={{
          paddingTop: insets.top + 88,
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
        }}
        pointerEvents="none"
      >
        <View className="self-start flex-row items-center gap-2 rounded-full bg-knowverse-star/15 px-3 py-1.5">
          <Feather name="zap" size={12} color="#f4d35e" />
          <Text className="text-knowverse-star text-xs font-medium">
            Quick recall
          </Text>
        </View>
        <Text
          className="text-knowverse-star/70 mt-2 text-xs"
          numberOfLines={1}
        >
          From: {record.card.title}
        </Text>
      </View>

      {/* Question + options pinned to the lower portion */}
      <View
        className="absolute left-0 right-0 px-6"
        style={{ bottom: insets.bottom + 24, top: 240 }}
      >
        <Text className="text-knowverse-star text-2xl font-semibold leading-snug">
          {record.quiz.question}
        </Text>

        <View className="mt-6 gap-2.5">
          {record.quiz.options.map((opt, i) => {
            const isPicked = picked === i;
            const isAnswer = i === record.quiz.correctIndex;
            const showResult = phase === 'answered';
            const bg = !showResult
              ? 'bg-knowverse/60 border-knowverse-star/15'
              : isAnswer
              ? 'bg-emerald-500/20 border-emerald-400/60'
              : isPicked
              ? 'bg-red-500/20 border-red-400/60'
              : 'bg-knowverse/40 border-knowverse-star/10';
            return (
              <Pressable
                key={i}
                disabled={showResult}
                onPress={() => onPick(i as 0 | 1 | 2 | 3)}
                accessibilityLabel={`Option ${i + 1}: ${opt}`}
                className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3.5 ${bg}`}
              >
                <View className="h-7 w-7 items-center justify-center rounded-full border border-knowverse-star/30">
                  <Text className="text-knowverse-star/80 text-xs font-semibold">
                    {String.fromCharCode(65 + i)}
                  </Text>
                </View>
                <Text
                  className="text-knowverse-star flex-1 text-base leading-snug"
                  numberOfLines={3}
                >
                  {opt}
                </Text>
                {showResult && isAnswer && (
                  <Feather name="check" size={18} color="#4ade80" />
                )}
                {showResult && isPicked && !isAnswer && (
                  <Feather name="x" size={18} color="#fca5a5" />
                )}
              </Pressable>
            );
          })}
        </View>

        {phase === 'answered' && (
          <View className="mt-6">
            <Text className="text-knowverse-star text-base font-semibold">
              {isCorrect ? 'Got it.' : 'Not quite.'}
            </Text>
            <Text className="text-knowverse-star/70 mt-2 text-sm leading-relaxed">
              {record.quiz.explanation}
            </Text>
            <Pressable
              onPress={() => {
                swipeCommit();
                onContinue();
              }}
              accessibilityLabel="Continue to the next card"
              className="bg-knowverse-star mt-5 self-start rounded-full px-6 py-3"
            >
              <Text className="text-knowverse-deep text-sm font-semibold">
                Keep going
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
