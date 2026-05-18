import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALL_TOPICS, toggleTopic, type Topic } from '@/lib/topicPrefs';
import { tapImpact } from '@/lib/haptics';

const MIN_TOPICS = 3;

// First-launch topic calibration step 1 of 2. Pick at least 3 topics
// from the curated 18 — these seed the For You feed before any
// engagement signal exists. The "≥ 3" bar is gentle: the Continue
// button stays disabled but the copy never scolds.
export default function OnboardingTopicsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<Topic>>(new Set());

  const onToggle = async (topic: Topic) => {
    tapImpact();
    // Mirror the toggle into SecureStore on every tap. If the user
    // bails mid-onboarding (force-quit), their picks survive.
    await toggleTopic(topic);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  const canContinue = selected.size >= MIN_TOPICS;

  return (
    <View
      className="flex-1 bg-knowverse-deep"
      style={{ paddingTop: insets.top + 24 }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-6">
        <Text className="text-knowverse-star/40 text-xs uppercase tracking-widest">
          Step 1 of 2
        </Text>
        <Text className="text-knowverse-star mt-2 text-3xl font-semibold leading-snug">
          What gets your{'\n'}curiosity going?
        </Text>
        <Text className="text-knowverse-star/60 mt-3 text-base leading-relaxed">
          Pick at least three. We'll use these to seed your feed — you can
          change them anytime in Settings.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 120,
        }}
      >
        <View className="flex-row flex-wrap gap-2.5">
          {ALL_TOPICS.map((t) => {
            const active = selected.has(t);
            return (
              <Pressable
                key={t}
                onPress={() => void onToggle(t)}
                accessibilityLabel={`${active ? 'Remove' : 'Add'} ${t}`}
                className={`rounded-full px-5 py-3 ${
                  active
                    ? 'bg-knowverse-star'
                    : 'border border-knowverse-star/20 bg-knowverse/60'
                }`}
              >
                <Text
                  className={`text-base font-medium ${
                    active ? 'text-knowverse-deep' : 'text-knowverse-star/80'
                  }`}
                >
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View
        className="absolute left-0 right-0 px-6"
        style={{ bottom: insets.bottom + 20 }}
        pointerEvents="box-none"
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-knowverse-star/50 text-sm">
            {selected.size} of {MIN_TOPICS}+ picked
          </Text>
          <Pressable
            disabled={!canContinue}
            onPress={() => router.push('/onboarding/cards' as never)}
            accessibilityLabel="Continue to calibration cards"
            className={`rounded-full px-7 py-3 ${
              canContinue ? 'bg-knowverse-star' : 'bg-knowverse-star/20'
            }`}
          >
            <Text
              className={`text-base font-semibold ${
                canContinue ? 'text-knowverse-deep' : 'text-knowverse-star/40'
              }`}
            >
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
