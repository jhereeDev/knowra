# 01 — Vision & Business Model

> **Name:** Knowra — an invented coinage rooted in *know* + the soft trailing *-ra* of *aura*. Six letters, two syllables, unambiguous pronunciation. Tagline: **expand your Knowra.** Visual identity leans into a space metaphor — every article a star in your personal *knowverse*. Domain: `knowra.space`. (Prior working name: *Ken* — dropped because `ken.app` was unavailable; the inherited "expand your ___" tagline shape carried over.)

---

## 1. The 30-second pitch

Most people spend 2–4 hours a day swiping through short-form video. That habit is already burned into the muscle memory of a generation. We're not going to break it. We're going to **redirect it**.

We're building a native iOS + Android app that gives people the same dopamine loop as TikTok or Reels — vertical full-screen cards, swipe-up-for-next, beautiful visuals, no settings, no thinking — but every card is a **bite-sized Wikipedia article** with a striking image, a 2-sentence hook, and an option to go deeper.

The pitch in one line: **TikTok for curiosity.** Same UX, opposite outcome.

## 2. Why now

Three forces are converging in 2026:

1. **Scroll fatigue & "content slop" backlash.** Public sentiment against algorithmic junk content is at an all-time high. People want to feel less stupid after picking up their phone, not more. Apps like Ground News, Substack, and Brilliant are growing on this thesis.
2. **A free, world-class content library exists.** Wikipedia has ~6.9M English articles, ~63M total across languages, all CC-BY-SA. Wikimedia Commons has ~110M media files. We have a Netflix-sized content library with $0 licensing cost.
3. **Cross-platform native is finally fast to build.** React Native + Expo (with the New Architecture in 2026) lets a tiny team ship a 60+ fps consumer-grade app to both iOS and Android from one codebase — what used to take two teams and 12 months now takes one team and four. And critically: **none of our planned revenue streams (affiliate, sponsored cards, B2B) are taxed by Apple or Google**, because none are digital in-app purchases. We get App Store distribution without paying the App Store tax.

## 3. The problem we solve

| For users | For institutions |
|---|---|
| "I feel guilty about how much time I waste on Instagram." | "Our students/employees won't read long-form content." |
| "I want to feel smarter but reading feels like work." | "We can't get them to engage with our learning portal." |
| "I open Wikipedia, get lost in tabs, and abandon them." | "Micro-learning works but tools feel like worksheets." |

We resolve the tension between *the urge to scroll* and *the desire to learn*. That's a real, felt, identity-level need — not a feature.

## 4. Target users (initial)

**Primary persona — "The Recovering Doomscroller"**
- 18–34, mostly urban, mostly mobile-first
- Has deleted TikTok at least once, redownloaded within a week
- Reads BBC headlines, listens to podcasts at 1.5×, follows a couple of Substacks
- Wants self-improvement but won't take a course or buy a $20 book on a whim

**Secondary persona — "The Trivia Sponge"**
- 25–55, knowledge worker, the friend who knows weird facts
- Already a Wikipedia donor or near-donor
- Will pay for *better* Wikipedia, not for an alternative to it

**Tertiary persona — "The Educator / L&D buyer"**
- High-school teacher, librarian, corporate L&D manager
- Looking for a "snackable learning" tool that students/employees actually open
- Buys per-seat or site-license

## 5. Competitive landscape

| Player | What they do | Where we win |
|---|---|---|
| Wikipedia mobile app | The source. Reference-grade but feels like an encyclopedia. | We're the *discovery layer* on top — entertainment-first. |
| Wikitok (the prototype the X post referenced) | First-mover, viral demo on web. | We build a real product around it: native app, personalization, retention, monetization, B2B. |
| TikTok / Reels / Shorts | Owns the habit. | We don't compete for time — we offer a *substitute* with the same loop and no guilt. |
| Brilliant, Duolingo | Gamified learning. | They feel like school. We feel like leisure. |
| Curiosity Stream, Nebula | Long-form documentaries. | We're the trailer reel; we drive traffic to them via affiliate links. |
| Ground News, Artifact (RIP) | News feeds. | News decays in 48 hours. Knowledge doesn't. Lower content cost, higher shelf life. |

**Key insight:** Nobody owns "the curiosity feed." It's an unbranded category. First brand to own it wins by default.

## 6. Why this is defensible (eventually)

The MVP is easy to copy. The moat compounds over time:

1. **Personalization data.** Every swipe, every "Tell me more," every share is a signal. The longer a user is on the app, the better the feed gets — and the harder it is to switch.
2. **Editorial layer.** Wikipedia is uneven; some articles are gold, most are not. We curate, summarize with AI, and pair articles with the right hero image. That curation layer is hard to clone.
3. **Brand.** Owning "the curiosity feed" mental category is the real moat — same way Notion owns "second brain" and Duolingo owns "language streaks."
4. **B2B distribution.** Once we're licensed by even one big school district or library system, the renewal economics fund consumer growth.

## 7. Business model overview

We are **not** doing a paid subscription. Three reasons:
- Friction kills viral growth in the early stage.
- The content is free and CC-licensed; charging for it feels gross and invites backlash from the Wikipedia community.
- Larger TAM if free.

Instead we monetize through three channels — covered in detail in `05-monetization.md`:

1. **Non-intrusive sponsored cards.** Native-style cards from museums, courses, podcasts, documentaries — content-aligned, clearly labeled, can be skipped like any other card.
2. **Affiliate links.** Every article has a "Go deeper" tray: books, courses, documentaries, podcasts. We earn affiliate revenue on conversions (Amazon, Coursera, MasterClass, Audible, etc.).
3. **B2B / EdTech licensing.** White-labeled or branded version for schools, libraries, museums, corporate L&D. Per-seat annual licensing.

## 8. Strategic principles

These are the principles we'll use to settle every product debate.

1. **The feed comes first.** Anything that slows the swipe loses.
2. **Smart, never smug.** No "well actually" tone. The app should feel like the friend who tells you fun facts at dinner, not the one who corrects your grammar.
3. **Beauty is a feature.** A bad hero image kills a good article. We invest in image curation.
4. **Respect the source.** Always credit Wikipedia. Always link out. Donate a percentage of revenue to the Wikimedia Foundation (also a great PR + acquisition lever).
5. **No dark patterns.** No fake notifications, no infinite-loading fakeouts, no "you've been gone 3 days" guilt. We win by being the *good* version of TikTok, not by copying its worst habits.

## 9. North star

**Daily active sessions per user with at least one "Save" or "Go deeper" click.**

Not just scroll-time. Scroll-time without engagement is just background TV. We win when people are *acting* on what they see.

---

*Next: see `02-product-spec.md` for what we're actually building.*
