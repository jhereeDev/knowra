# App Store metadata — Knowra 1.0

> Copy-paste source for App Store Connect. Update this file when you change
> any field in ASC so we don't drift. Promotional Text and What's New can
> be edited without re-review; everything else needs re-submission.

---

## App Information (set once, persists across versions)

| Field | Value |
|---|---|
| **Name** (30 char max) | `Knowra` |
| **Subtitle** (30 char max) | `The Wikipedia curiosity feed` |
| **Primary language** | English (U.S.) |
| **Bundle ID** | `space.knowra.app` |
| **SKU** | `knowra-ios-001` |
| **Primary category** | Reference |
| **Secondary category** | Education |
| **Content rights** | "Does your app contain, display, or access third-party content?" → **Yes** (Wikipedia content under CC BY-SA 4.0) |
| **Age rating** | 12+ (see Age Rating section below) |

---

## Version-specific metadata (iOS App → 1.0)

### Promotional Text (170 char max — editable without review)

```
Beautifully presented Wikipedia articles in a vertical scroll. Same dopamine as short-form video, redirected toward something worth your time.
```

(160 chars)

### Description (4000 char max)

```
Knowra turns the scroll loop into a curiosity engine. Every swipe surfaces a beautifully presented Wikipedia article — a striking image, a two-sentence hook, and the option to dive deeper. Same mechanic as short-form video. Different payload.

Four feeds, one tap each:

• For You — learns from how you swipe. The more you use it, the better it gets.
• Trending — today's most-read Wikipedia articles, worldwide.
• Today — what happened on this date through history.
• Random — pure curiosity. Anything goes.

What we built it for:

The bottomless scroll is one of the most powerful inventions of the last decade. The problem isn't the mechanic — the problem is what the mechanic is pointed at. Knowra points it at Wikipedia: 60+ million articles of carefully edited human knowledge, presented in a way that respects both your time and your attention.

No ads. No tracking. No App Tracking Transparency prompt — we don't ask, because we don't track. No infinite-engagement dark patterns. No personalization based on who you are; only on what you've looked at.

A few things you can do:

• Save articles to collections (Read Later, Science Reading, whatever you want).
• Pull down to refresh.
• Tap an article to read the full Wikipedia page in a clean dark reader.
• Search Wikipedia directly when you're looking for something specific.
• Tune your topic preferences in Settings — choose History, Science, Nature, Sport, and a dozen more.
• Track your daily reading streak.

Every article links back to the source. Wikipedia is the work of hundreds of thousands of volunteers — we're committed to surfacing it well and giving back. Knowra pledges 5% of net revenue to the Wikimedia Foundation.

Knowra is independent and not affiliated with or endorsed by the Wikimedia Foundation. All article content is licensed under CC BY-SA 4.0 and remains the property of its contributors.

Questions, ideas, bugs? jheremiah.dev@gmail.com — every email gets a real reply.

Expand your Knowra.
```

### Keywords (100 char max, comma-separated, NO spaces after commas)

```
wikipedia,knowledge,curiosity,trivia,learning,facts,reading,discover,history,science,article,explore
```

(96 chars)

### What's New in This Version

```
Welcome to Knowra. Swipe to learn something new every minute.

This is our first release. You'll find four feeds (For You, Trending, Today, Random), a dark in-app reader, savable collections, and a clean topic-preferences setting to tune what you see.

Tap "More like this" on any article to get related cards injected into your feed.

Found a bug or have a feature idea? jheremiah.dev@gmail.com.
```

### URLs

| Field | Value |
|---|---|
| **Support URL** | `https://knowra.space/support` |
| **Marketing URL** | `https://knowra.space` |
| **Privacy Policy URL** | `https://knowra.space/privacy` |

### Copyright

```
© 2026 Jheremiah Figueroa
```

### Version Release

- ✅ **Automatically release this version** (recommended for first launch — Apple's approval is the gate; you've already QA'd via TestFlight)

---

## App Privacy (left sidebar, separate from App Information)

Click "Get Started" → "Yes, we collect data from this app".

### Data Types Collected

| Data Type | Linked to user? | Used for tracking? | Purposes |
|---|---|---|---|
| **Identifiers → Device ID** (anonymous) | No | No | App Functionality |
| **Usage Data → Product Interaction** (swipes, saves, opens) | No | No | App Functionality, Analytics |
| **Other Data → Topic preferences** | No | No | App Functionality, Personalization |

### Data NOT Collected

Leave unchecked: Contact Info, Health & Fitness, Financial Info, Location,
Sensitive Info, Contacts, User Content, Search History, Browsing History,
Diagnostics, Other Data Types.

> If/when we add Sentry or PostHog, come back here and add **Diagnostics →
> Crash Data** and **Performance Data**.

### Tracking

Answer **"No"** to "Does this app collect data used to track the user?"

---

## Age Rating questionnaire

Honest answers — Wikipedia covers everything from poetry to war. Expected
result: **12+**.

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | Infrequent/Mild |
| Sexual Content or Nudity | Infrequent/Mild |
| Profanity or Crude Humor | Infrequent/Mild |
| Alcohol, Tobacco, or Drug Use | Infrequent/Mild |
| Mature/Suggestive Themes | Infrequent/Mild |
| Horror/Fear Themes | None |
| Prolonged Graphic or Sadistic Violence | None |
| Graphic Sexual Content and Nudity | None |
| Medical/Treatment Information | Infrequent/Mild |
| Gambling | None |
| Contests | None |
| Unrestricted Web Access | **No** (the in-app reader is scoped to Wikipedia; the system browser opens only when the user taps "Open in browser") |

---

## App Review Information

| Field | Value |
|---|---|
| **First Name** | Jheremiah |
| **Last Name** | Figueroa |
| **Phone Number** | (your real number) |
| **Email** | jheremiah.dev@gmail.com |
| **Sign-in Required** | **No** (the public release doesn't gate any content behind sign-in) |
| **Demo Account Username / Password** | leave blank |
| **Notes for the Reviewer** | (see below) |

### Reviewer notes

```
Knowra is a content discovery app for Wikipedia. All articles are sourced via Wikipedia's public APIs (REST and Core API) under CC BY-SA 4.0. The app doesn't require sign-in and has no in-app purchases.

The "in-app reader" loads articles from en.m.wikipedia.org with a dark-themed CSS overlay. Tapping any external link or "Open in browser" hands off to Safari.

The "hook" text under each article title is generated by Anthropic Claude from the article's first paragraph — it's an editorial summary, not user-generated content. If a hook ever appears inappropriate, the user can tap to open the original Wikipedia article.

Attribution to Wikipedia is shown on every card (footer line) and at the bottom of the in-app reader. License and attribution details are on our About page: https://knowra.space/about

Please reach out via the email above if anything needs clarification.
```

---

## Pre-submission checklist

Run through this in order in App Store Connect before clicking "Submit for Review":

- [ ] App Information → all fields filled, Privacy Policy URL set
- [ ] iOS App 1.0 → Promotional Text + Description + Keywords + What's New all in
- [ ] iOS App 1.0 → Build selected (must be the 1.0.0 production build that's processed)
- [ ] iOS App 1.0 → All required screenshots uploaded (6.7" minimum)
- [ ] App Privacy → answered, matches /privacy page
- [ ] Age Rating → questionnaire complete, expected 12+
- [ ] App Review Information → contact + notes filled
- [ ] Version Release → choice made (auto recommended)
- [ ] Click **Add for Review** → review the summary page → **Submit for Review**

Expected review time: 24–48 hours typical.
