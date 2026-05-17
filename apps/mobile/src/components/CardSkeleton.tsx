import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  type AnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { ViewProps } from 'react-native';

const AnimatedView = Animated.View as unknown as React.ComponentType<
  AnimatedProps<ViewProps> & { children?: React.ReactNode }
>;

// Card-shaped placeholder that pulses gently while we fetch the first
// batch. Replaces the bare ActivityIndicator. The shimmer is opacity-
// only (no gradient sweep) — costs ~nothing and reads as "loading"
// without being noisy.
export function CardSkeleton() {
  const pulse = useSharedValue(0.4);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
  }, []);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.7, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // Measure the container, then size everything in absolute pixels.
  // Mirrors the real card layout (62% hero, capped 640px reading column)
  // without any percentage strings touching Reanimated styles.
  const heroHeight = size.height * 0.62;
  const colWidth = Math.min(size.width, 640);
  return (
    <View className="flex-1 bg-knowverse-deep" onLayout={onLayout}>
      {size.height === 0 ? null : (
        <>
          <AnimatedView
            style={[
              { width: size.width, height: heroHeight, backgroundColor: '#0a1234' },
              pulseStyle,
            ]}
          />
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 32,
              width: colWidth,
              alignSelf: 'center',
            }}
          >
            <AnimatedView
              style={[
                { height: 30, width: colWidth * 0.65, backgroundColor: '#0f1740', borderRadius: 6 },
                pulseStyle,
              ]}
            />
            <AnimatedView
              style={[
                { height: 14, width: colWidth * 0.35, backgroundColor: '#0c1233', borderRadius: 4, marginTop: 14 },
                pulseStyle,
              ]}
            />
            <AnimatedView
              style={[
                { height: 14, width: colWidth * 0.88, backgroundColor: '#0c1233', borderRadius: 4, marginTop: 24 },
                pulseStyle,
              ]}
            />
            <AnimatedView
              style={[
                { height: 14, width: colWidth * 0.82, backgroundColor: '#0c1233', borderRadius: 4, marginTop: 8 },
                pulseStyle,
              ]}
            />
            <AnimatedView
              style={[
                { height: 14, width: colWidth * 0.45, backgroundColor: '#0c1233', borderRadius: 4, marginTop: 8 },
                pulseStyle,
              ]}
            />
          </View>
        </>
      )}
    </View>
  );
}
