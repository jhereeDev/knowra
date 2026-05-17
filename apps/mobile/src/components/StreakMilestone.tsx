import { useEffect } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import type { ViewProps } from 'react-native';
import Animated, {
  type AnimatedProps,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { Milestone } from '@/lib/streak';

const AnimatedView = Animated.View as unknown as React.ComponentType<
  AnimatedProps<ViewProps> & { children?: React.ReactNode }
>;

const COPY: Record<Milestone, { title: string; body: string }> = {
  3: {
    title: 'Three days in a row.',
    body: "Habits start here. Tomorrow's card is already getting interesting.",
  },
  7: {
    title: 'A full week.',
    body: "You're officially curious. Most apps don't keep people this long — Wikipedia does.",
  },
  30: {
    title: 'Thirty straight days.',
    body: 'A month of small detours through everything. The bottomless rabbit hole, served daily.',
  },
  100: {
    title: 'One hundred days.',
    body: "You've redirected the dopamine loop. This is the version of scrolling worth keeping.",
  },
};

export function StreakMilestone({
  milestone,
  onDismiss,
}: {
  milestone: Milestone | null;
  onDismiss: () => void;
}) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (milestone === null) {
      scale.value = 0.8;
      opacity.value = 0;
      return;
    }
    opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    scale.value = withSequence(
      withTiming(1.06, { duration: 260, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 180, easing: Easing.inOut(Easing.ease) }),
    );
  }, [milestone, scale, opacity]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!milestone) return null;
  const { title, body } = COPY[milestone];

  return (
    <Modal
      visible={milestone !== null}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable
        onPress={onDismiss}
        className="flex-1 items-center justify-center bg-knowverse-deep/90 px-8"
      >
        <AnimatedView
          style={[
            cardStyle,
            { width: '100%', maxWidth: 360 },
          ]}
          className="rounded-3xl border border-knowverse-star/15 bg-knowverse/80 p-7"
        >
          <View className="items-center">
            <View className="flex-row items-baseline">
              <Text className="text-knowverse-star text-7xl font-bold">{milestone}</Text>
              <Text className="text-knowverse-star/60 ml-2 text-2xl font-medium">days</Text>
            </View>
            <Text className="text-knowverse-star mt-4 text-center text-xl font-semibold">
              {title}
            </Text>
            <Text className="text-knowverse-star/60 mt-3 text-center text-sm leading-relaxed">
              {body}
            </Text>
            <Pressable
              onPress={onDismiss}
              className="bg-knowverse-star mt-7 rounded-full px-7 py-2.5"
            >
              <Text className="text-knowverse-deep text-sm font-semibold">
                Keep going
              </Text>
            </Pressable>
          </View>
        </AnimatedView>
      </Pressable>
    </Modal>
  );
}

// Suppress unused-import warnings for the helper above
void withDelay;
