import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { WebView as RawWebView } from 'react-native-webview';
import type { WebView as WebViewType, WebViewProps } from 'react-native-webview';
import { Feather as RawFeather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cardBatchResponseSchema, type Card } from '@knowra/shared';
import { tapImpact } from '@/lib/haptics';
import { getDeviceId } from '@/lib/device';
import { showToast } from '@/lib/toast';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// React-19 JSX-class casts (same recurring pattern).
type FeatherProps = { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> };
const Feather = RawFeather as unknown as React.ComponentType<FeatherProps>;
type WebViewExtraProps = { ref?: React.Ref<WebViewType> };
const WebView = RawWebView as unknown as React.ComponentType<
  WebViewProps & WebViewExtraProps
>;

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
  const [loading, setLoading] = useState(true);
  const [findingRelated, setFindingRelated] = useState(false);
  const open = card !== null;

  // Prefer the Wikipedia mobile site (m.wikipedia.org) so the page is
  // already small-screen-friendly before our CSS overrides land.
  const mobileUrl = card
    ? card.wikipediaUrl.replace('://en.wikipedia.org', '://en.m.wikipedia.org')
    : '';

  const openExternal = async () => {
    if (!card) return;
    tapImpact();
    await Linking.openURL(card.wikipediaUrl);
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
        {/* Header bar */}
        <View className="flex-row items-center justify-between border-b border-knowverse-star/10 px-4 py-3">
          <Pressable onPress={onClose} accessibilityLabel="Close reader" hitSlop={10}>
            <Feather name="x" size={22} color="#e7e9ff" />
          </Pressable>
          <Text className="text-knowverse-star/80 text-sm font-medium" numberOfLines={1}>
            Wikipedia
          </Text>
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
            <WebView
              source={{ uri: mobileUrl }}
              originWhitelist={['https://*']}
              injectedJavaScriptBeforeContentLoaded={INJECTED_BEFORE}
              onLoadEnd={() => setLoading(false)}
              style={{ backgroundColor: '#05071a' }}
              startInLoadingState={false}
              // No `decelerationRate` here — it's an iOS-only prop, and on
              // Android with Fabric/New Architecture the codegen types it
              // as a Float. Passing the string "normal" or "fast" crashes
              // the view creation with `java.lang.String cannot be cast
              // to java.lang.Double` (this exact error surfaced when users
              // tapped Open on an Android device).
            />
            {loading && (
              <View
                className="absolute inset-0 items-center justify-center bg-knowverse-deep/90"
                pointerEvents="none"
              >
                <ActivityIndicator color="#e7e9ff" />
                <Text className="text-knowverse-star/50 mt-3 text-xs">opening article…</Text>
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
