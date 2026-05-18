import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { Feather as RawFeather } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

// @expo/vector-icons' Icon class doesn't satisfy React 19's JSX class
// constraint (same recurring issue as expo-image / Animated.View).
// Inline the props shape since `React.ComponentProps<typeof RawFeather>`
// fails for the same reason.
type FeatherIconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};
const Feather = RawFeather as unknown as React.ComponentType<FeatherIconProps>;
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCardFeed, type FeedItem, type FeedType } from '@/hooks/useCardFeed';
import { VerticalPager } from '@/components/VerticalPager';
import { CardView } from '@/components/CardView';
import { CardSkeleton } from '@/components/CardSkeleton';
import { DonationNudge } from '@/components/DonationNudge';
import { OnboardingSwipeHint } from '@/components/OnboardingSwipeHint';
import { SkipUndoToast } from '@/components/SkipUndoToast';
import { Toast } from '@/components/Toast';
import { flush, track } from '@/lib/events';
import { useSavedIds } from '@/lib/savedArticles';
import { consumeNextMilestone, useStreak, type Milestone } from '@/lib/streak';
import { markSwipeSeen, useHasSeenSwipeHint } from '@/lib/onboarding';
import { bumpImpression } from '@/lib/nudgeCounter';
import { StreakMilestone } from '@/components/StreakMilestone';

const QUICK_SKIP_MS = 1500;

// Visual tab order — must match the tab pill row at the top.
// Swipe RIGHT → next tab in this list. Swipe LEFT → previous.
const TAB_ORDER: FeedType[] = ['foryou', 'trending', 'today', 'random'];

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function FeedScreen() {
  const [feedType, setFeedType] = useState<FeedType>('random');
  const feed = useCardFeed(feedType);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const savedIds = useSavedIds();
  const streak = useStreak();
  const hasSeenSwipeHint = useHasSeenSwipeHint();
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [skipUndoVisible, setSkipUndoVisible] = useState(false);
  const lastImpressionId = useRef<string | null>(null);

  // When the streak count changes, see if we just crossed a milestone.
  // Consume returns the milestone exactly once across all launches.
  useEffect(() => {
    if (streak.count < 3) return;
    void consumeNextMilestone(streak).then((m) => {
      if (m) setMilestone(m);
    });
  }, [streak]);

  // Emit an impression each time the current CARD changes. Guards against
  // double-fire on re-renders when current still resolves to the same item.
  // Nudge slots are not impressions and don't bump the donation counter.
  useEffect(() => {
    const current = feed.current;
    if (!current || current.kind !== 'card') return;
    if (lastImpressionId.current === current.key) return;
    lastImpressionId.current = current.key;
    track(current.card.articleId, 'impression');
    // Donation nudge gate (product spec §4.11): every ~50 cards, inject
    // a nudge slot just after the current position. The counter is
    // SecureStore-backed and idempotent — only fires once per multiple.
    void bumpImpression().then((shouldInject) => {
      if (shouldInject) feed.injectNudgeAfterCurrent('donation');
    });
  }, [feed]);

  // Best-effort flush on unmount so we don't lose the last few events when
  // the user backgrounds the app from this screen.
  useEffect(() => () => void flush(), []);

  // Also flush when the OS sends the app to the background — events sit
  // in memory until the queue is full or the timer fires; backgrounding
  // is the most common loss vector.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') void flush();
    });
    return () => sub.remove();
  }, []);

  const handleAdvance = (dwellMs: number) => {
    const current = feed.current;
    // Only track engagement events on real cards. Swiping past a nudge
    // is a UX-level dismissal, not a content interaction — no event row.
    if (current?.kind === 'card') {
      const isQuickSkip = dwellMs < QUICK_SKIP_MS;
      track(current.card.articleId, isQuickSkip ? 'quick_skip' : 'swipe_up', { dwellMs });
      // Offer undo on quick-skips — "wait, that one looked interesting".
      // After advance() the card we just skipped becomes `prev`, so goBack
      // always has somewhere to land.
      if (isQuickSkip) setSkipUndoVisible(true);
    }
    if (hasSeenSwipeHint === false) void markSwipeSeen();
    feed.advance();
  };

  const handleGoBack = (dwellMs: number) => {
    const current = feed.current;
    if (current?.kind === 'card') {
      track(current.card.articleId, 'swipe_back', { dwellMs });
    }
    if (hasSeenSwipeHint === false) void markSwipeSeen();
    feed.goBack();
  };

  const currentTabIndex = TAB_ORDER.indexOf(feedType);
  const handleSwitchTab = (direction: 'next' | 'prev') => {
    const delta = direction === 'next' ? 1 : -1;
    const nextIndex = currentTabIndex + delta;
    if (nextIndex < 0 || nextIndex >= TAB_ORDER.length) return;
    const target = TAB_ORDER[nextIndex];
    if (target) setFeedType(target);
  };

  if (feed.state.kind === 'loading') {
    return <CardSkeleton />;
  }

  if (feed.state.kind === 'error') {
    return (
      <View
        className="flex-1 items-center justify-center bg-knowverse-deep px-8"
        style={{ paddingTop: insets.top }}
      >
        <Text className="text-red-300 text-base">✗ {feed.state.message}</Text>
        <Text className="text-knowverse-star/40 mt-3 text-center text-xs">
          API: {API_URL}/api/cards/batch{'\n'}On a physical device, set EXPO_PUBLIC_API_URL to
          your machine&apos;s LAN IP in apps/mobile/.env.
        </Text>
        <Pressable
          onPress={feed.retry}
          className="bg-knowverse-star/10 mt-6 rounded-full px-5 py-2"
        >
          <Text className="text-knowverse-star text-sm">try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-knowverse-deep">
      <VerticalPager<FeedItem>
        prev={feed.prev}
        current={feed.current}
        next={feed.next}
        canGoBack={feed.canGoBack}
        onAdvance={handleAdvance}
        onGoBack={handleGoBack}
        renderItem={(item) =>
          item.kind === 'card' ? (
            <CardView card={item.card} onInjectRelated={feed.insertAfterCurrent} />
          ) : (
            <DonationNudge onDismiss={feed.advance} />
          )
        }
        keyExtractor={(item) => item.key}
        // Pull-to-refresh on the feed: only fires when we're at the start
        // (no `prev`) and the user pulls down past 30% screen height.
        onRefresh={feed.retry}
        // Horizontal swipe to change feed tabs.
        onSwitchTab={handleSwitchTab}
        canSwitchTabNext={currentTabIndex < TAB_ORDER.length - 1}
        canSwitchTabPrev={currentTabIndex > 0}
      />

      {/* First-launch hint — only renders before the user's first swipe.
          pointerEvents:none on the hint itself; the pager still receives
          the gesture underneath. */}
      {hasSeenSwipeHint === false && feed.current && (
        <OnboardingSwipeHint bottom={insets.bottom + 140} />
      )}

      <SkipUndoToast
        visible={skipUndoVisible}
        bottom={insets.bottom + 24}
        onUndo={() => {
          setSkipUndoVisible(false);
          feed.goBack();
        }}
        onDismiss={() => setSkipUndoVisible(false)}
      />

      <StreakMilestone milestone={milestone} onDismiss={() => setMilestone(null)} />
      <Toast bottom={insets.bottom + 84} />

      {/* Top chrome: two stacked rows — tab pills on top, actions on
          a second row. Stacking gives both rows full screen width;
          previously they fought each other horizontally and overlapped
          the card's source badge. The streak chip moved into the same
          row as the action icons so it doesn't claim its own line. */}
      <View
        style={{ top: insets.top + 8, left: 0, right: 0 }}
        className="absolute"
        pointerEvents="box-none"
      >
        {/* Row 1: tab pills, centered */}
        <View className="items-center" pointerEvents="box-none">
          <View className="flex-row gap-1 rounded-full bg-knowverse/70 px-1 py-1">
            <FeedTab
              label="For You"
              active={feedType === 'foryou'}
              onPress={() => setFeedType('foryou')}
            />
            <FeedTab
              label="Trending"
              active={feedType === 'trending'}
              onPress={() => setFeedType('trending')}
            />
            <FeedTab
              label="Today"
              active={feedType === 'today'}
              onPress={() => setFeedType('today')}
            />
            <FeedTab
              label="Random"
              active={feedType === 'random'}
              onPress={() => setFeedType('random')}
            />
          </View>
        </View>

        {/* Row 2: streak + actions, anchored right */}
        <View
          className="mt-2 flex-row items-center justify-end gap-2 px-3"
          pointerEvents="box-none"
        >
          {streak.count >= 2 && (
            <View
              className="flex-row items-center gap-1 rounded-full bg-knowverse/70 px-2.5 py-1"
              accessibilityLabel={`${streak.count}-day streak`}
            >
              <Text className="text-[13px]">🔥</Text>
              <Text className="text-knowverse-star text-xs font-medium">
                {streak.count}
              </Text>
            </View>
          )}
          <Pressable
            onPress={() => router.push('/search')}
            accessibilityLabel="Search Wikipedia"
            className="h-9 w-9 items-center justify-center rounded-full bg-knowverse/70"
          >
            <Feather name="search" size={16} color="#e7e9ff" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/saved')}
            accessibilityLabel="Open saved articles"
            className="h-9 w-9 items-center justify-center rounded-full bg-knowverse/70"
          >
            <Feather name="bookmark" size={16} color="#e7e9ff" />
            {savedIds.size > 0 && (
              <View className="absolute -right-1 -top-1 h-4 min-w-4 items-center justify-center rounded-full bg-knowverse-star px-1">
                <Text className="text-knowverse-deep text-[9px] font-bold">
                  {savedIds.size}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityLabel="Open settings"
            className="h-9 w-9 items-center justify-center rounded-full bg-knowverse/70"
          >
            <Feather name="settings" size={16} color="#e7e9ff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function FeedTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${label} feed`}
      className={`rounded-full px-4 py-1.5 ${active ? 'bg-knowverse-star' : ''}`}
    >
      <Text
        className={`text-sm font-medium ${
          active ? 'text-knowverse-deep' : 'text-knowverse-star/70'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
