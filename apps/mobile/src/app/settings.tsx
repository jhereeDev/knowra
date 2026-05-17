import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALL_TOPICS, toggleTopic, useTopicPrefs, type Topic } from '@/lib/topicPrefs';
import { useStreak } from '@/lib/streak';
import { tapImpact } from '@/lib/haptics';

// Clerk's useAuth/useUser are not imported here for the same reason
// _layout.tsx skips ClerkProvider — see that file for the dev-client
// note. AccountSection will return once Clerk is reinstated.

export default function SettingsScreen() {
  const selected = useTopicPrefs();
  const streak = useStreak();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-knowverse-deep">
      <Stack.Screen
        options={{
          title: 'Settings',
          headerShown: true,
          headerStyle: { backgroundColor: '#05071a' },
          headerTintColor: '#e7e9ff',
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* Account — disabled in Expo Go; reactivates with a dev client */}

        {/* Topic preferences */}
        <Section title="Topics you like" hint="A nudge for the For You feed. Toggle any.">
          <View className="flex-row flex-wrap gap-2 px-5 pt-2">
            {ALL_TOPICS.map((t) => (
              <TopicPill key={t} topic={t} active={selected.has(t)} />
            ))}
          </View>
        </Section>

        {/* Streak */}
        <Section title="Your streak">
          <View className="flex-row items-center gap-3 px-5 pt-3">
            <Text className="text-2xl">🔥</Text>
            <View>
              <Text className="text-knowverse-star text-2xl font-semibold">
                {streak.count} {streak.count === 1 ? 'day' : 'days'}
              </Text>
              <Text className="text-knowverse-star/50 mt-1 text-xs">
                {streak.count >= 2
                  ? "You've opened Knowra on consecutive days."
                  : 'Open the app tomorrow to start a streak.'}
              </Text>
            </View>
          </View>
        </Section>

        {/* About / attribution */}
        <Section title="About">
          <View className="px-5 pt-3">
            <Text className="text-knowverse-star/80 text-sm leading-relaxed">
              Knowra is a curiosity feed. Every card is a Wikipedia article — we
              don't write the encyclopedia, we just bring you to it.
            </Text>
            <Text className="text-knowverse-star/80 mt-3 text-sm leading-relaxed">
              All content is licensed CC BY-SA 4.0 by the Wikipedia community. We
              pledge 5% of revenue to the Wikimedia Foundation.
            </Text>
            <Pressable
              onPress={() => void Linking.openURL('https://creativecommons.org/licenses/by-sa/4.0/')}
              className="mt-4"
            >
              <Text className="text-knowverse-star/60 text-xs underline">
                Read the CC BY-SA 4.0 license
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void Linking.openURL('https://wikimediafoundation.org/')}
              className="mt-2"
            >
              <Text className="text-knowverse-star/60 text-xs underline">
                Support the Wikimedia Foundation
              </Text>
            </Pressable>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-6">
      <View className="px-5">
        <Text className="text-knowverse-star/50 text-xs uppercase tracking-widest">
          {title}
        </Text>
        {hint && <Text className="text-knowverse-star/40 mt-1 text-xs">{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

function TopicPill({ topic, active }: { topic: Topic; active: boolean }) {
  const onPress = () => {
    tapImpact();
    void toggleTopic(topic);
  };
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${active ? 'Remove' : 'Add'} ${topic}`}
      className={`rounded-full px-4 py-2 ${
        active ? 'bg-knowverse-star' : 'bg-knowverse/60 border border-knowverse-star/20'
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          active ? 'text-knowverse-deep' : 'text-knowverse-star/70'
        }`}
      >
        {topic}
      </Text>
    </Pressable>
  );
}
