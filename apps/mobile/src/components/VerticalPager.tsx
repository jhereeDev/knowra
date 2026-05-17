import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, TextStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Feather as RawFeather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ViewProps } from 'react-native';
import Animated, {
  type AnimatedProps,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { swipeCommit } from '@/lib/haptics';
import { PagerContext } from '@/components/PagerContext';

// Reanimated 4's Animated.View class type doesn't satisfy React 19's JSX
// constraint (missing `refs` on its Component base). Cast for JSX use;
// runtime behavior is unchanged. Mirrors the workaround for expo-image.
const AnimatedView = Animated.View as unknown as React.ComponentType<
  AnimatedProps<ViewProps> & { children?: React.ReactNode }
>;

type FeatherProps = { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> };
const Feather = RawFeather as unknown as React.ComponentType<FeatherProps>;

type Props<T> = {
  prev: T | undefined;
  current: T | undefined;
  next: T | undefined;
  canGoBack: boolean;
  onAdvance: (dwellMs: number) => void;
  onGoBack: (dwellMs: number) => void;
  renderItem: (item: T) => React.ReactNode;
  // Stable identifier per item — used as a React key so each slot remounts
  // cleanly when its card changes, avoiding the "previous image briefly
  // shows during swipe" recycling artifact.
  keyExtractor: (item: T) => string;
  // Optional: called when the user pulls down past the refresh threshold
  // while at the start of the feed (no previous card). Use to reload the
  // initial batch — feels like pull-to-refresh on a ScrollView.
  onRefresh?: () => void;
  // Optional: horizontal-swipe handlers for switching feed tabs.
  // Follows the standard iOS/Twitter/Instagram pattern:
  //   swipe LEFT  (negative translationX) → 'next' tab — next page slides in from the right
  //   swipe RIGHT (positive translationX) → 'prev' tab — previous page slides in from the left
  // Boundary props gate which direction is allowed; disabled directions
  // rubber-band instead of committing.
  onSwitchTab?: (direction: 'next' | 'prev') => void;
  canSwitchTabNext?: boolean;
  canSwitchTabPrev?: boolean;
};

const SNAP_FRACTION = 0.22; // % of screen height to commit a swipe
const VELOCITY_THRESHOLD = 800; // px/s
const COMMIT_DURATION = 220;
const SPRING_CONFIG = { damping: 22, stiffness: 220, mass: 0.6 };
const REFRESH_FRACTION = 0.3; // % of screen height at boundary to trigger refresh

export function VerticalPager<T>({
  prev,
  current,
  next,
  canGoBack,
  onAdvance,
  onGoBack,
  renderItem,
  keyExtractor,
  onRefresh,
  onSwitchTab,
  canSwitchTabNext = true,
  canSwitchTabPrev = true,
}: Props<T>) {
  // Measure the pager's actual rendered size via onLayout instead of
  // useWindowDimensions — Android's tablet compatibility mode reports
  // phone-sized window values even though the app renders full-screen,
  // which leaves the slots short and lets the next card peek at the
  // bottom. Layout measurement is always accurate.
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
  }, []);
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  // Mirror canGoBack into a shared value so the refresh-indicator
  // worklet style can read it without a re-binding dance.
  const canGoBackSV = useSharedValue(canGoBack ? 1 : 0);
  const canNextSV = useSharedValue(canSwitchTabNext ? 1 : 0);
  const canPrevSV = useSharedValue(canSwitchTabPrev ? 1 : 0);
  useEffect(() => {
    canGoBackSV.value = canGoBack ? 1 : 0;
  }, [canGoBack, canGoBackSV]);
  useEffect(() => {
    canNextSV.value = canSwitchTabNext ? 1 : 0;
  }, [canSwitchTabNext, canNextSV]);
  useEffect(() => {
    canPrevSV.value = canSwitchTabPrev ? 1 : 0;
  }, [canSwitchTabPrev, canPrevSV]);
  // Wallclock when the current card entered. We compute dwell at the moment
  // the swipe commits so it represents real time-on-card.
  const enteredAtRef = useRef(Date.now());

  // Reset the dwell clock whenever the underlying current changes.
  useEffect(() => {
    enteredAtRef.current = Date.now();
  }, [current]);

  const commitAdvance = useCallback(() => {
    swipeCommit();
    onAdvance(Date.now() - enteredAtRef.current);
  }, [onAdvance]);
  const commitGoBack = useCallback(() => {
    swipeCommit();
    onGoBack(Date.now() - enteredAtRef.current);
  }, [onGoBack]);

  const verticalPan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .failOffsetX([-18, 18])
        .onUpdate((e) => {
          'worklet';
          // Rubber-band at boundaries: when there's no neighbor, halve the drag.
          let dy = e.translationY;
          if (dy > 0 && !canGoBack) dy = dy * 0.4;
          if (dy < 0 && next === undefined) dy = dy * 0.4;
          translateY.value = dy;
        })
        .onEnd((e) => {
          'worklet';
          const threshold = height * SNAP_FRACTION;
          const refreshThreshold = height * REFRESH_FRACTION;
          const swipingUp =
            e.translationY < -threshold || e.velocityY < -VELOCITY_THRESHOLD;
          const swipingDown =
            e.translationY > threshold || e.velocityY > VELOCITY_THRESHOLD;
          // At the boundary (no prev card), a strong pull-down triggers
          // a feed refresh — mimics ScrollView's pull-to-refresh affordance.
          const pullingToRefresh =
            !canGoBack &&
            onRefresh !== undefined &&
            (e.translationY > refreshThreshold ||
              (e.translationY > threshold && e.velocityY > VELOCITY_THRESHOLD));

          if (swipingUp && next !== undefined) {
            translateY.value = withTiming(-height, { duration: COMMIT_DURATION }, () => {
              runOnJS(commitAdvance)();
              translateY.value = 0;
            });
          } else if (swipingDown && canGoBack) {
            translateY.value = withTiming(height, { duration: COMMIT_DURATION }, () => {
              runOnJS(commitGoBack)();
              translateY.value = 0;
            });
          } else if (pullingToRefresh) {
            // Animate back to neutral, then trigger the JS-side refresh.
            translateY.value = withSpring(0, SPRING_CONFIG, () => {
              runOnJS(onRefresh)();
            });
          } else {
            translateY.value = withSpring(0, SPRING_CONFIG);
          }
        }),
    [canGoBack, height, next, commitAdvance, commitGoBack, onRefresh, translateY],
  );

  // Horizontal pan — tab switcher. Activates only on clearly horizontal
  // gestures (activeOffsetX) and fails if the user is clearly going
  // vertical (failOffsetY). Raced with the vertical pan so the first to
  // activate wins exclusively.
  //
  // Direction mapping (standard iOS / Twitter / Instagram):
  //   swipe LEFT  (negative dx) = NEXT tab (next page slides in from the right)
  //   swipe RIGHT (positive dx) = PREV tab (previous page slides in from the left)
  const horizontalPan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-15, 15])
        .failOffsetY([-12, 12])
        .onUpdate((e) => {
          'worklet';
          let dx = e.translationX;
          // Rubber-band at boundaries: positive dx → going to PREV, so
          // rubber-band when we can't go prev. Negative dx → going to
          // NEXT, rubber-band when we can't go next.
          if (dx > 0 && canPrevSV.value === 0) dx = dx * 0.4;
          if (dx < 0 && canNextSV.value === 0) dx = dx * 0.4;
          translateX.value = dx;
        })
        .onEnd((e) => {
          'worklet';
          const threshold = width * 0.25;
          const swipingRight =
            e.translationX > threshold || e.velocityX > VELOCITY_THRESHOLD;
          const swipingLeft =
            e.translationX < -threshold || e.velocityX < -VELOCITY_THRESHOLD;
          const handler = onSwitchTab;
          if (swipingLeft && canNextSV.value === 1 && handler !== undefined) {
            // Slide current OFF to the left (next page comes from the right).
            translateX.value = withTiming(-width, { duration: COMMIT_DURATION }, () => {
              runOnJS(handler)('next');
              translateX.value = 0;
            });
          } else if (swipingRight && canPrevSV.value === 1 && handler !== undefined) {
            translateX.value = withTiming(width, { duration: COMMIT_DURATION }, () => {
              runOnJS(handler)('prev');
              translateX.value = 0;
            });
          } else {
            translateX.value = withSpring(0, SPRING_CONFIG);
          }
        }),
    [width, onSwitchTab, canNextSV, canPrevSV, translateX],
  );

  const pan = useMemo(
    () => Gesture.Race(verticalPan, horizontalPan),
    [verticalPan, horizontalPan],
  );

  const stackStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
  }));

  // Refresh indicator — only visible when:
  //   - we're at the start of the feed (canGoBack === false)
  //   - the user is pulling DOWN (translateY > 0)
  //   - onRefresh is wired
  // Fades in over the first 30px of pull, rotates 180° as the pull
  // approaches the refresh threshold, and translates a bit so it
  // doesn't feel pinned.
  const refreshThresholdPx = height * REFRESH_FRACTION;
  const refreshIndicatorStyle = useAnimatedStyle(() => {
    if (canGoBackSV.value === 1 || translateY.value <= 0 || onRefresh === undefined) {
      return { opacity: 0 };
    }
    const opacity = Math.min(translateY.value / 30, 1);
    const progress = Math.min(translateY.value / refreshThresholdPx, 1);
    const rotation = progress * 180;
    return {
      opacity,
      transform: [
        { translateY: Math.min(translateY.value * 0.3, 50) },
        { rotate: `${rotation}deg` },
      ],
    };
  });
  // Border color is harder to interpolate inside a worklet-style; we
  // gate the "ready to release" affordance with a separate style that
  // becomes fully opaque once progress crosses 1.
  const refreshReadyStyle = useAnimatedStyle(() => {
    if (canGoBackSV.value === 1 || translateY.value <= 0 || onRefresh === undefined) {
      return { opacity: 0 };
    }
    const progress = translateY.value / refreshThresholdPx;
    return { opacity: progress >= 1 ? 1 : 0 };
  });

  return (
    <PagerContext.Provider value={{ translateY }}>
    <GestureDetector gesture={pan}>
      <View style={{ flex: 1, overflow: 'hidden' }} onLayout={onLayout}>
        {/* Pull-to-refresh indicator. Sits above the card stack, hidden
            by default; opacity + rotation animate with the pull distance.
            pointerEvents:none so the pan gesture still hits the pager. */}
        {onRefresh !== undefined && (
          <AnimatedView
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: insets.top + 18,
                alignSelf: 'center',
                zIndex: 10,
              },
              refreshIndicatorStyle,
            ]}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderWidth: 1.5,
                borderColor: 'rgba(231,233,255,0.25)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="chevron-down" size={22} color="#e7e9ff" />
              {/* "Ready" overlay — same circle in the Knowverse star
                  color, becomes opaque once the pull crosses the
                  threshold. Tells the user they can release. */}
              <AnimatedView
                pointerEvents="none"
                style={[
                  {
                    position: 'absolute',
                    top: -1.5,
                    left: -1.5,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    borderWidth: 1.5,
                    borderColor: '#e7e9ff',
                  },
                  refreshReadyStyle,
                ]}
              />
            </View>
          </AnimatedView>
        )}

        <AnimatedView style={[{ flex: 1 }, stackStyle]}>
          {/* Previous card — sits one screen up. key by item identity so
              React fully unmounts/remounts when the slot's card changes
              (prevents native Image from showing a stale bitmap during
              the snap-back). */}
          {prev !== undefined && (
            <View
              key={`prev-${keyExtractor(prev)}`}
              style={{
                position: 'absolute',
                top: -height,
                left: 0,
                right: 0,
                height,
              }}
            >
              {renderItem(prev)}
            </View>
          )}

          {/* Current card */}
          {current !== undefined && (
            <View
              key={`current-${keyExtractor(current)}`}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}
            >
              {renderItem(current)}
            </View>
          )}

          {/* Next card — sits one screen down */}
          {next !== undefined && (
            <View
              key={`next-${keyExtractor(next)}`}
              style={{
                position: 'absolute',
                top: height,
                left: 0,
                right: 0,
                height,
              }}
            >
              {renderItem(next)}
            </View>
          )}
        </AnimatedView>
      </View>
    </GestureDetector>
    </PagerContext.Provider>
  );
}
