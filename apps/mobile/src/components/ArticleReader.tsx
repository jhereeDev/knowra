import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { WebView as RawWebView } from 'react-native-webview';
import type { WebView as WebViewType, WebViewProps } from 'react-native-webview';
import { Image as RawExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';
import { Feather as RawFeather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cardBatchResponseSchema,
  type ArticleSummaryResponse,
  type Card,
} from '@knowra/shared';
import { tapImpact } from '@/lib/haptics';
import { getDeviceId } from '@/lib/device';
import { fetchArticleSummary } from '@/lib/articleSummary';
import { showToast } from '@/lib/toast';
import { recordKnowverseEdge, recordKnowverseStar } from '@/lib/knowverse';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// React-19 JSX-class casts (same recurring pattern).
type FeatherProps = { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> };
const Feather = RawFeather as unknown as React.ComponentType<FeatherProps>;
type WebViewExtraProps = { ref?: React.Ref<WebViewType> };
const WebView = RawWebView as unknown as React.ComponentType<
  WebViewProps & WebViewExtraProps
>;
const Image = RawExpoImage as unknown as React.ComponentType<ExpoImageProps>;

// Reading-mode CSS injected into Wikipedia's mobile site to strip chrome
// and apply our dark theme. Hides headers, footers, navigation, edit
// links, language picker — leaving just the article body in a readable
// dark layout. Lives inline so we don't need a separate asset.
const READER_CSS = `
  :root {
    color-scheme: dark;
    --kw-bg: #05071a;
    --kw-fg: #e7e9ff;
    --kw-fg-muted: rgba(231,233,255,0.65);
    --kw-link: #a8b4ff;
    --kw-border: rgba(231,233,255,0.08);
  }
  html, body, #content, .mw-body { background: var(--kw-bg) !important; color: var(--kw-fg) !important; }
  /* Strip Wikipedia chrome */
  .header-container, .pre-content, .page-actions-menu, .last-modified-bar,
  .minerva-footer, .mw-footer, #mw-mf-page-left, .header-chrome,
  .nomobile, .mobile-float-reset, .mw-jump-link, .vector-pinnable-header,
  .vector-page-toolbar, #siteNotice, #mw-navigation, .page-heading-actions,
  .mw-cite-backlink, .mw-editsection, .navbox, .navbox-styles, .ambox,
  .hatnote, .reference, .reflist, .references, .references-small,
  .printfooter, .catlinks, .noprint { display: none !important; }
  body { padding: 16px 18px 80px !important; margin: 0 !important; line-height: 1.65 !important; font-size: 17px !important; -webkit-font-smoothing: antialiased; }
  h1, h2, h3, h4 { color: var(--kw-fg) !important; border: none !important; margin-top: 1.8em !important; }
  h1 { font-size: 28px !important; line-height: 1.2 !important; margin-top: 0 !important; }
  h2 { font-size: 22px !important; padding-bottom: 6px; border-bottom: 1px solid var(--kw-border) !important; }
  h3 { font-size: 18px !important; }
  p { color: var(--kw-fg-muted) !important; margin: 1em 0 !important; }
  a { color: var(--kw-link) !important; text-decoration: none !important; }
  a:hover { text-decoration: underline !important; }
  img, video { max-width: 100% !important; height: auto !important; border-radius: 8px; }
  figure { margin: 1.5em 0 !important; }
  figcaption { color: var(--kw-fg-muted) !important; font-size: 13px !important; opacity: 0.75; }
  table, .infobox, .wikitable { background: rgba(255,255,255,0.04) !important; border: 1px solid var(--kw-border) !important; border-radius: 8px; color: var(--kw-fg) !important; }
  th, td { color: var(--kw-fg-muted) !important; border-color: var(--kw-border) !important; padding: 6px 10px !important; }
  blockquote { border-left: 3px solid var(--kw-link) !important; padding-left: 12px; color: var(--kw-fg) !important; }
  ul, ol { color: var(--kw-fg-muted) !important; }
  hr { border-color: var(--kw-border) !important; }
  pre, code { background: rgba(255,255,255,0.06) !important; color: var(--kw-fg) !important; border-radius: 4px; padding: 2px 6px; }
`;

// `injectedJavaScriptBeforeContentLoaded` runs before the page body is
// parsed; we drop the CSS into a <style> in <head>. document.documentElement
// styling fires immediately so the user never sees the white flash.
const INJECTED_BEFORE = `
  (function(){
    var s = document.createElement('style');
    s.innerHTML = ${JSON.stringify(READER_CSS)};
    document.documentElement.style.background = '#05071a';
    document.documentElement.appendChild(s);
  })();
  true;
`;

type Tab = 'summary' | 'full';

export function ArticleReader({
  card,
  onClose,
  onMoreLikeThis,
}: {
  card: Card | null;
  onClose: () => void;
  // When provided, a "More like this" pill appears in the footer.
  // Tapping fetches related articles and forwards them to the parent
  // (typically to inject into the feed buffer). Reader closes after.
  onMoreLikeThis?: (related: Card[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('summary');
  // Lazy-mount the WebView once the user switches to Full. Toggling tabs
  // after that point uses display:none so the WebView keeps its scroll
  // position and doesn't reload on every switch.
  const [webViewVisited, setWebViewVisited] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);

  const [summary, setSummary] = useState<ArticleSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [findingRelated, setFindingRelated] = useState(false);
  const open = card !== null;
  // Track which wikiId we've fetched the summary for, so cycling through
  // cards in the reader (if ever wired) refetches cleanly.
  const fetchedForWikiId = useRef<string | null>(null);

  // Prefer the Wikipedia mobile site (m.wikipedia.org) so the page is
  // already small-screen-friendly before our CSS overrides land.
  const mobileUrl = card
    ? card.wikipediaUrl.replace('://en.wikipedia.org', '://en.m.wikipedia.org')
    : '';

  // Reset state when the reader opens with a new card.
  useEffect(() => {
    if (!card) return;
    if (fetchedForWikiId.current === card.wikiId) return;
    fetchedForWikiId.current = card.wikiId;
    setTab('summary');
    setWebViewVisited(false);
    setWebViewLoading(true);
    setSummary(null);
    setSummaryError(null);
    setSummaryLoading(true);

    let cancelled = false;
    void fetchArticleSummary(card.wikiId)
      .then((res) => {
        if (cancelled) return;
        setSummary(res);
        setSummaryError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSummaryError(err instanceof Error ? err.message : 'failed to load summary');
      })
      .finally(() => {
        if (cancelled) return;
        setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [card]);

  const openExternal = async () => {
    if (!card) return;
    tapImpact();
    await Linking.openURL(card.wikipediaUrl);
  };

  const switchTab = (next: Tab) => {
    if (next === tab) return;
    tapImpact();
    setTab(next);
    if (next === 'full' && !webViewVisited) setWebViewVisited(true);
  };

  const onFindRelated = async () => {
    if (!card || !onMoreLikeThis) return;
    tapImpact();
    setFindingRelated(true);
    try {
      const deviceId = await getDeviceId();
      const res = await fetch(`${API_URL}/api/cards/related/${card.wikiId}?count=6`, {
        headers: { 'X-Knowra-Device-Id': deviceId },
      });
      if (!res.ok) {
        showToast('Couldn’t find related articles');
        return;
      }
      const json: unknown = await res.json();
      const parsed = cardBatchResponseSchema.parse(json);
      // Knowverse: each related card becomes a star, with an edge from
      // the article the user was reading to each new related article.
      // The source article must already be a star for the edge to land;
      // we promote it here in case the user reached the reader without
      // having saved it first.
      void recordKnowverseStar(card);
      for (const related of parsed.cards) {
        void (async () => {
          await recordKnowverseStar(related);
          await recordKnowverseEdge(card.articleId, related.articleId);
        })();
      }
      onMoreLikeThis(parsed.cards);
      onClose();
    } catch {
      showToast('Couldn’t find related articles');
    } finally {
      setFindingRelated(false);
    }
  };

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-knowverse-deep" style={{ paddingTop: insets.top }}>
        {/* Header bar: close | segmented control | external-link */}
        <View className="flex-row items-center justify-between border-b border-knowverse-star/10 px-4 py-3">
          <Pressable onPress={onClose} accessibilityLabel="Close reader" hitSlop={10}>
            <Feather name="x" size={22} color="#e7e9ff" />
          </Pressable>
          <TabSwitch tab={tab} onChange={switchTab} />
          <Pressable
            onPress={() => void openExternal()}
            accessibilityLabel="Open in browser"
            hitSlop={10}
          >
            <Feather name="external-link" size={20} color="#e7e9ff" />
          </Pressable>
        </View>

        {open && card && (
          <View className="flex-1">
            {/* Summary pane — native scroll, AI-generated body. */}
            <View
              style={{ flex: 1, display: tab === 'summary' ? 'flex' : 'none' }}
            >
              <SummaryPane
                card={card}
                summary={summary}
                loading={summaryLoading}
                error={summaryError}
                bottomInset={insets.bottom}
                onReadFull={() => switchTab('full')}
              />
            </View>

            {/* Full pane — Wikipedia mobile site in a stripped-chrome WebView.
                Mounted only after the user first switches to it; remains
                mounted afterwards so toggling back is instant. */}
            {webViewVisited && (
              <View
                style={{ flex: 1, display: tab === 'full' ? 'flex' : 'none', position: 'absolute', inset: 0, top: 0 }}
                pointerEvents={tab === 'full' ? 'auto' : 'none'}
              >
                <WebView
                  source={{ uri: mobileUrl }}
                  originWhitelist={['https://*']}
                  injectedJavaScriptBeforeContentLoaded={INJECTED_BEFORE}
                  onLoadEnd={() => setWebViewLoading(false)}
                  style={{ backgroundColor: '#05071a' }}
                  startInLoadingState={false}
                  // No `decelerationRate` here — it's an iOS-only prop, and on
                  // Android with Fabric/New Architecture the codegen types it
                  // as a Float. Passing the string "normal" or "fast" crashes
                  // the view creation with `java.lang.String cannot be cast
                  // to java.lang.Double` (this exact error surfaced when users
                  // tapped Open on an Android device).
                />
                {webViewLoading && (
                  <View
                    className="absolute inset-0 items-center justify-center bg-knowverse-deep/90"
                    pointerEvents="none"
                  >
                    <ActivityIndicator color="#e7e9ff" />
                    <Text className="text-knowverse-star/50 mt-3 text-xs">opening article…</Text>
                  </View>
                )}
              </View>
            )}

            {/* Footer CTA — "Find more like this" injects related
                cards into the feed and closes the reader. */}
            {onMoreLikeThis && (
              <View
                style={{ paddingBottom: insets.bottom + 12 }}
                className="absolute bottom-0 left-0 right-0 items-center pt-2"
                pointerEvents="box-none"
              >
                <Pressable
                  onPress={() => void onFindRelated()}
                  disabled={findingRelated}
                  className={`flex-row items-center gap-2 rounded-full px-5 py-2.5 ${
                    findingRelated ? 'bg-knowverse/70' : 'bg-knowverse-star'
                  }`}
                  style={{
                    shadowColor: '#000',
                    shadowOpacity: 0.35,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                  }}
                >
                  {findingRelated ? (
                    <>
                      <ActivityIndicator color="#e7e9ff" size="small" />
                      <Text className="text-knowverse-star text-sm font-semibold">
                        Finding more…
                      </Text>
                    </>
                  ) : (
                    <>
                      <Feather name="compass" size={16} color="#05071a" />
                      <Text className="text-knowverse-deep text-sm font-semibold">
                        More like this
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

function TabSwitch({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <View className="flex-row items-center rounded-full border border-knowverse-star/15 bg-black/30 p-0.5">
      <TabPill label="Summary" active={tab === 'summary'} onPress={() => onChange('summary')} />
      <TabPill label="Full article" active={tab === 'full'} onPress={() => onChange('full')} />
    </View>
  );
}

function TabPill({
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
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={6}
      className={`rounded-full px-3 py-1 ${active ? 'bg-knowverse-star' : ''}`}
    >
      <Text
        className={`text-xs font-semibold ${
          active ? 'text-knowverse-deep' : 'text-knowverse-star/70'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryPane({
  card,
  summary,
  loading,
  error,
  bottomInset,
  onReadFull,
}: {
  card: Card;
  summary: ArticleSummaryResponse | null;
  loading: boolean;
  error: string | null;
  bottomInset: number;
  onReadFull: () => void;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: bottomInset + 96, // room for the More-like-this pill
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero strip — smaller than the feed card; gives context without
          dominating the reading column. */}
      <View
        style={{
          height: 220,
          backgroundColor: card.image?.dominantColor ?? '#0a1234',
          position: 'relative',
        }}
      >
        {card.image && (
          <Image
            source={{ uri: card.image.url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
            accessibilityLabel={card.title}
          />
        )}
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(5,7,26,0.35)',
          }}
        />
      </View>

      {/* Title block — outside the hero so it can wrap freely on long titles. */}
      <View className="px-5 pt-5">
        {card.categories.length > 0 && (
          <View className="mb-2 flex-row flex-wrap gap-1.5">
            {card.categories.slice(0, 3).map((cat) => (
              <View
                key={cat}
                className="rounded-full border border-knowverse-star/20 bg-black/40 px-2.5 py-0.5"
              >
                <Text className="text-knowverse-star/80 text-[10px] font-medium uppercase tracking-wider">
                  {cat}
                </Text>
              </View>
            ))}
          </View>
        )}
        <Text className="text-white text-[26px] font-bold leading-tight">{card.title}</Text>
        {card.subtitle && (
          <Text className="text-knowverse-star/65 mt-1.5 text-[13px] italic">
            {card.subtitle}
          </Text>
        )}
      </View>

      {/* Summary body — loading skeleton, error, or content. */}
      <View className="mt-6 px-5">
        {loading && <SummarySkeleton />}
        {!loading && error && (
          <Text className="text-knowverse-star/60 text-[15px] leading-[24px]">
            Couldn’t load the summary right now. Tap{' '}
            <Text className="text-knowverse-star font-semibold" onPress={onReadFull}>
              Full article
            </Text>{' '}
            above to read it on Wikipedia.
          </Text>
        )}
        {!loading && !error && summary && <SummaryBody text={summary.summary} />}

        {!loading && !error && summary?.source === 'extract' && (
          <View className="mt-4 flex-row items-start gap-2 rounded-md border border-knowverse-star/15 bg-black/20 p-3">
            <Feather name="info" size={14} color="rgba(231,233,255,0.6)" style={{ marginTop: 2 }} />
            <Text className="text-knowverse-star/65 text-[12px] leading-[18px] flex-1">
              Showing the Wikipedia extract — the AI summary couldn’t be generated.
            </Text>
          </View>
        )}
      </View>

      {/* Attribution + CTA into the full article. */}
      <View className="mt-8 px-5">
        <View className="flex-row items-center gap-2">
          <View className="h-px flex-1 bg-knowverse-star/10" />
          <Text className="text-knowverse-star/40 text-[10px] uppercase tracking-[1.5px]">
            {summary?.attribution ?? card.attribution}
          </Text>
          <View className="h-px flex-1 bg-knowverse-star/10" />
        </View>
        <Pressable
          onPress={onReadFull}
          className="mt-5 flex-row items-center justify-center gap-2 self-center rounded-full border border-knowverse-star/25 px-4 py-2"
          hitSlop={6}
        >
          <Text className="text-knowverse-star text-[13px] font-semibold">
            Read the full article
          </Text>
          <Feather name="arrow-right" size={14} color="#e7e9ff" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SummaryBody({ text }: { text: string }) {
  // The model is instructed to emit blank-line-separated paragraphs.
  // Render each as a Text block to get our line-height / color tokens.
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  return (
    <View>
      {paragraphs.map((p, i) => (
        <Text
          key={i}
          className="text-knowverse-star/90 text-[16px] leading-[26px]"
          style={{ marginTop: i === 0 ? 0 : 14 }}
        >
          {p.trim()}
        </Text>
      ))}
    </View>
  );
}

function SummarySkeleton() {
  // Static placeholder bars — no animation needed. The first summary
  // call takes ~2-3s (LLM); the bars communicate "we're working on it"
  // without the over-eager pulse of a full skeleton component.
  const bar = (w: ViewStyle['width']) => (
    <View
      style={{
        width: w,
        height: 12,
        borderRadius: 4,
        backgroundColor: 'rgba(231,233,255,0.08)',
        marginTop: 10,
      }}
    />
  );
  return (
    <View>
      <View className="flex-row items-center gap-2">
        <ActivityIndicator color="#e7e9ff" size="small" />
        <Text className="text-knowverse-star/55 text-[12px]">writing summary…</Text>
      </View>
      <View style={{ marginTop: 14 }}>
        {bar('100%')}
        {bar('94%')}
        {bar('88%')}
        {bar('60%')}
      </View>
      <View style={{ marginTop: 18 }}>
        {bar('100%')}
        {bar('90%')}
        {bar('72%')}
      </View>
      <View style={{ marginTop: 18 }}>
        {bar('92%')}
        {bar('80%')}
      </View>
    </View>
  );
}
