# 02 — Product Spec

This document defines what we're building and why each piece exists. Pair it with `03-technical-architecture.md` for the "how."

---

## 1. Design tenets (UX-level)

1. **Zero chrome on first open.** No login wall, no onboarding survey, no permission requests. Land → swipe → hooked.
2. **One thumb, one direction.** Vertical swipe-up is the only navigation that matters. Everything else is secondary.
3. **The card is the unit.** Each card is a self-contained article preview: hero image, title, era/category tag, 2-sentence hook, and an action tray.
4. **120ms feels native.** All transitions, swipes, and image loads should be sub-perceptual or use skeleton loaders that feel intentional.
5. **Dark mode default.** Matches the reference apps. Better for OLED, better for evening doomscroll sessions, and lets photos pop.
6. **Space as the visual spine.** The brand lives in a *knowverse* metaphor — deep-space gradients, soft starfields, articles as "stars" you've encountered, related topics as orbits. Used sparingly (background textures, transitions, the rabbit-hole graph) so it never overpowers the hero image of the card. Pairs naturally with the dark-mode default.

## 2. Platform-specific design notes

This is a **native iOS + Android app** (React Native + Expo). That changes a handful of product decisions vs. a web-first approach:

- **Gestures are richer.** We get haptics on commit, true 60–120 fps swipe, and the ability to "pull-to-reveal" the action tray with one thumb.
- **Push notifications work properly** on iOS — no PWA-install dance required. Daily digest becomes a first-class retention mechanism.
- **App Store presence** is itself a discovery channel. Optimize listing + screenshots.
- **No ATT prompt** — we deliberately don't track users across apps and won't ask for IDFA. The "We don't track you" line is part of our brand.
- **Universal Links / App Links** mean any shared article URL deep-links into the app if installed. Important for word-of-mouth.

## 3. Core feed (MVP)

### 3.1 Card anatomy

```
┌──────────────────────────────┐
│  [Hero image fills top 60%]  │
│                              │
│  Tab bar: Random | For You | │
│           Today              │
│                              │
│  [Year/era badge]            │
│                              │
│  Title                       │
│  Subtitle / category         │
│                              │
│  2-sentence AI hook          │
│                              │
│  [Save] [Share] [Go deeper▾] │
│  [Home]            [Profile] │
└──────────────────────────────┘
```

### 3.2 The three feeds

Three tabs across the top, switching changes the next card stream:

- **Random** — pure serendipity. Pulled from Wikipedia's random article endpoint, lightly filtered for image quality and article completeness. Default for new users — no profile required.
- **For You** — personalized. Activates after ~10 swipes. Surfaces articles that fit the user's emerging interest graph (more in `04-data-algorithm.md`).
- **Today** — date-relevant. "On this day in history," birthdays, anniversaries, what happened *exactly* on today's date in past years. Best section for daily-return habit.

### 3.3 The "Go deeper" tray

When tapped, slides up a sheet with:

- The first ~300 words of the article (so people can actually *read* without leaving)
- "Read full article on Wikipedia" link
- Related articles (3–5 cards, horizontally scrollable)
- **Affiliate row:** "If this interested you…" → curated book / course / documentary / podcast picks (this is the monetization surface — see `05-monetization.md`)
- Share / Save buttons

This is the single most important screen in the app. It's where curiosity converts to either learning or revenue. Spend disproportionate design time here.

### 3.4 Gestures

| Gesture | Action | Haptic |
|---|---|---|
| Swipe up | Next card | Light tap on commit |
| Swipe down | Previous card | Light tap on commit |
| Long-press | Reveal full caption + author/license | Medium tap on engage |
| Double-tap | Save | Success notification haptic |
| Swipe left | Open "Go deeper" tray | Soft impact |
| Pull down at top | Refresh feed | Selection feedback |

All gestures run on the native UI thread via Reanimated 3 + Gesture Handler. Target a sustained 60+ fps swipe (120 fps on capable devices, e.g. iPhone 14 Pro+).

## 4. Features beyond the MVP (the differentiators)

The X-post version is *just* the feed. To make people actually love the app and come back, we add the following — many of these are what make the app feel like a *product* rather than a demo.

### 4.1 Streaks (the smart way)
- "Days you learned something new" counter
- A streak only counts if the user **interacted** with at least 3 cards (saved, shared, or opened Go-deeper). Pure scrolling doesn't count.
- No guilt prompts for broken streaks. Just a gentle "Welcome back, ready for a new one?"

### 4.2 The "Rabbit Hole" mode
- Tap any underlined entity in an article → that entity becomes the next card.
- Visually rendered as a connected graph after 5+ jumps (drawn natively with Skia). ("You went from Aztec calendars → corn → Iowa → corn syrup → high fructose lobby → Coca-Cola formula.")
- Shareable as an image — "My rabbit hole today" — viral hook.

### 4.3 Topic filters (the soft profile)
- Optional. Three-tap "What are you into?" picker at session 2 — 24 visual chips (Space, History, Art, Tech, Food, Nature, etc.)
- Multi-select; weight the For You feed accordingly.
- Persists in MMKV even before signup. Tied to account if user signs in later.

### 4.4 "Surprise me" jolt
- One-button mode: hides UI, autoplays a card every 8 seconds with ambient narration (AI-generated TTS, opt-in).
- Use case: cooking, commuting, falling asleep — true background audio via `expo-av` keeps it playing with the screen off.
- Becomes the foundation for an *audio* mode later — competes with podcasts for ear time.

### 4.5 Daily digest (native push)
- One **rich push** per day, user-set time (default: 8:30am).
- iOS: Notification Service Extension renders hero image + 2-line hook inline in the lock-screen card.
- Tap → deep-link directly to that card. Cards pre-fetched by background task.
- Always includes one "On this day" card.

### 4.6 Collections
- Users can save cards into named collections ("Space stuff," "Bedtime stories," "Things I'll forget by tomorrow").
- Shareable as a stack — like a Spotify playlist for knowledge — opens in app via Universal Link, or in the marketing site if app not installed.
- Foundation for social features in v2.

### 4.7 The "Did I learn anything?" recap
- End-of-session prompt (after 15+ cards in a session): "You learned about 12 things today. Want a recap?"
- Generates a 3-bullet email or saves to Collections. Massive retention lever.

### 4.8 AI hooks & summaries (the editorial layer)
- LLM-generated 2-sentence hook for every article (not the lede — a *hook*: the most surprising/dopamine-inducing fact).
- LLM-generated 300-word "if you only read one thing" summary for the Go-deeper tray.
- Both human-reviewed for top 10k most-trafficked articles.
- This is what separates us from "just a random Wikipedia button."

### 4.9 Quiz cards (sparingly)
- Every ~20 cards, inject a "Quick check" card: "You just saw this fact about [X]. True or false?"
- Reinforces memory (spaced repetition lite), turns scrolling into actual *learning*, and creates a clean inflection in the swipe rhythm.
- Caveat: must be optional / dismissible. Too many breaks the loop.

### 4.10 Sound on (carefully)
- Optional ambient audio: AI-narrated card, plus subtle music bed.
- Defaults to **off**. Many users scroll in silent contexts (commute, bed, work).
- Respects the iOS silent switch and Android "Do Not Disturb."

### 4.11 Wikipedia donate nudge
- After every ~50 cards: small, dismissible card that says *"100% of what you just read was written by volunteers. We donated $X to Wikipedia this month. Add yours?"*
- This is brand-defining. It signals values, builds trust, and is a moat against accusations of "scraping Wikipedia for ad revenue."

## 5. Anti-patterns we will not adopt

- **No "Streak about to break!" panic notifications.**
- **No autoplay videos in the feed.** Video drains battery, requires more bandwidth, and dilutes the core proposition.
- **No paid "unlock" friction.** No paywalls on articles. The whole library is free, forever.
- **No clickbait in hooks.** The hook must be true. If the article doesn't deliver on the hook, we cut the hook.
- **No infinite loading.** If we can't show the next card in 800ms, we show a *good* skeleton — not a spinner.
- **No infinite "for you" without a way out.** Users must be able to switch back to Random at any moment.
- **No ATT prompt** asking for cross-app tracking permission. We don't need IDFA and we don't ask for it. This is a positioning win.
- **No App Store rating prompt before D7.** We only ask satisfied users who have come back; never on session 1.

## 6. Onboarding flow

```
First launch (after App Store install)
    ↓
Show Random feed immediately — no login, no walkthrough, no permission asks
    ↓
After 5 cards: small "What are you into?" sheet (skippable)
    ↓
After 10 cards: "Save this for later?" → light account create (email magic link / Sign in with Apple)
    ↓
After 20 cards: "Want a daily digest?" → iOS/Android push permission ask
    ↓
After 50 cards: Wikipedia donation prompt (optional)
    ↓
After D3 + session ≥ 15 cards: native App Store rating prompt (StoreKit `requestReview`)
```

Every ask comes after the user has already received value. Nothing is asked up-front. Specifically, we do **not** ask for push permission on first launch — that's the single highest-leverage decision in mobile UX.

## 7. Settings (minimal)

- Profile (email, name, Sign in with Apple / Google linkage)
- Topic preferences
- Daily digest time + days-of-week
- Sound on/off
- Haptics on/off
- Reduce motion (mirrors iOS / Android system setting by default)
- Image quality (Wi-Fi only / always high / data saver)
- Privacy: clear my history, opt out of personalization, delete my account, export my data
- Language (Wikipedia language version)

## 8. Accessibility & inclusion

- All animations honor the system "Reduce Motion" setting on both platforms.
- Dynamic Type (iOS) and font-scale (Android) supported throughout — no fixed-pixel text sizes.
- Min contrast ratio 4.5:1 on text overlays.
- Every card has alt-text for the hero image (VoiceOver / TalkBack reads it).
- Audio narration option doubles as an accessibility tool — entire app navigable without sight.
- Localization-ready from day one (Wikipedia exists in 300+ languages — biggest TAM lever).

## 9. Edge cases worth designing for

- **Article has no good image.** Use a curated fallback library (Wikimedia Commons pulls) themed by category.
- **Article is stub-quality.** Filter out at ingest. Minimum 500 words + one image to be eligible.
- **Article is controversial / NSFW / current-events sensitive.** Safe-search layer; current events older than 30 days only by default (App Store kid-safe compliance).
- **User keeps swiping past a topic.** Negative signal — downweight in For You.
- **Offline / on a flight.** Last 50 viewed cards + all saved cards available offline.
- **Low-end Android (RAM-constrained).** Detect device class on launch; switch to lower image variant + simpler animations automatically.
- **iOS Low Power Mode.** Drop frame rate target from 60→30, disable haptics, throttle prefetch.

## 10. Success metrics (product-level)

| Metric | Target by month 3 | Target by month 12 |
|---|---|---|
| D1 retention | 35% | 50% |
| D7 retention | 15% | 25% |
| D30 retention | 8% | 15% |
| Avg session length | 4 min | 7 min |
| Cards per session | 12 | 25 |
| % sessions with "Go deeper" tap | 8% | 18% |
| % sessions with "Save" | 12% | 25% |

These mirror short-video benchmarks but bias toward engagement quality over raw time.

---

*Next: see `03-technical-architecture.md` for how this is built.*
