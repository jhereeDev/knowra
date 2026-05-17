# 05 — Monetization Strategy

Three revenue streams, in order of payoff curve: **affiliate** is fastest to start, **sponsored cards** scales best, **B2B/EdTech** is the most defensible. We do them in parallel but stagger the operational lift.

> **Platform context.** We're shipping native iOS + Android. That means we operate under Apple's App Store Review Guidelines + Google's Play Policies. The big monetization-relevant rules are summarized in §0 below.

---

## 0. App Store ground rules (read this first)

Three things shape monetization on iOS + Android that wouldn't apply to a PWA:

1. **In-app digital subscriptions or "unlock" purchases must use Apple IAP / Google Play Billing.** Apple takes 30% (15% under the Small Business Program for revenue under $1M/year, and on subscription renewals after year 1). Google's terms are similar. *We deliberately don't sell subscriptions or digital unlocks — see §1 — which sidesteps this entirely.*
2. **Affiliate / external links are allowed for physical goods, services, and "reader" apps**, with restrictions. Post-2024 rulings (Epic v. Apple, EU DMA) have loosened this further: in the US we can now use external-link account / web entitlements with disclosure. In the EU we have alternative payment options. **Our affiliate links to books, courses, documentaries, and podcasts are fully allowed.**
3. **Sponsored content / native ads are allowed** as long as they're clearly disclosed as advertising and we don't violate App Tracking Transparency (we don't track for ads, so we're fine).

Bottom line: our three planned revenue streams are all fully compatible with App Store + Play Store policies, and **none of them are taxed by Apple or Google** because none of them are digital in-app purchases. This is one of the under-appreciated wins of our model.

## 1. Why no subscription (a deliberate choice)

We considered freemium (Pro: offline mode, topic filters, audio narration, no ads). We're not doing it. Reasons:

- **Viral economics.** Every paywall is a fork in the funnel. We need raw reach to win the category.
- **Apple tax.** A subscription would route through Apple IAP — 15–30% off the top. Affiliate + sponsored = $0 tax.
- **Content politics.** Charging for derivative work of CC-licensed Wikipedia content invites legitimate criticism. We'd rather sponsor Wikipedia than charge users for it.
- **Margin math.** Our content costs $0. Our infra is cheap. A 1% affiliate take-rate on 100k DAU beats $5/mo from 1% of those same users — and doesn't create the wrong incentives.
- **Future option.** We can always add a "Supporter" tier later (no ads, fund Wikipedia donations, exclusive collections). It's never closed — but it's not the first move.

## 2. Stream 1: Affiliate links ("Go deeper" tray)

### 2.1 How it works
Every article has a "Go deeper" tray. Below the related-articles row sits a curated *"If this interested you…"* section with 2–4 affiliate items:
- A book (Amazon Associates, Bookshop.org for non-US-Amazon traffic)
- A relevant course (Coursera, MasterClass, Brilliant — all have affiliate programs)
- A documentary or video (Curiosity Stream, Nebula, Magellan TV — all have affiliate programs)
- A podcast episode (no native affiliate, but we route via Podscribe or our own UTM if needed)

### 2.2 How we curate
- For top-10k articles: human-curated affiliate items by part-time editors / freelancers.
- For long tail: LLM proposes items based on article title + summary, validated against the affiliate partner's catalog API; approved or auto-rejected by confidence threshold.

### 2.3 Economics (illustrative)
- Amazon Associates: 1–4.5% commission depending on category (lower for books, higher for electronics).
- Coursera Affiliates: ~15% on initial purchases.
- MasterClass: ~30% commission, $180 AOV.
- Audible: $5–$15 bounty per trial signup.
- Conservative blended assumption: **$0.30 RPM (revenue per 1k Go-deeper opens)** in year 1, climbing to **$1.50 RPM** as curation improves.

### 2.4 Disclosure & trust
- "Affiliate" label on every item. No dark patterns.
- We publish our partnerships page. We never recommend something we wouldn't recommend organically.
- Tapping an affiliate link uses an in-app browser (`expo-web-browser` / `SFSafariViewController` on iOS, Chrome Custom Tabs on Android) — preserves cookies/state for conversion while keeping the user one tap from the app. Required by Apple's external-link guidelines when redirecting outside the app context.

### 2.5 Why this works
Wikipedia readers are the *single best demographic in the world for books, courses, and documentaries*. Conversion rates are 3–5× higher than generic display traffic. The intent is already at the top of the funnel.

## 3. Stream 2: Sponsored cards (non-intrusive ads)

### 3.1 Concept
A native-style card in the feed, identical layout to organic, with a small "Sponsored" tag. The user can swipe past it like any other card. CTA: "Learn more" or "Visit site."

### 3.2 Who buys
We sell to advertisers whose content *fits* the curiosity feed:
- Museums (the Met, the Smithsonian, the British Museum) — they spend on awareness
- Online education (Coursera, edX, Brilliant, Khan Academy — also pays affiliate)
- Documentary platforms (Nebula, Curiosity Stream, History Channel)
- Book publishers (Penguin Random House, Knopf, university presses)
- Podcast networks (Wondery, Pushkin)
- Mission-aligned consumer brands (Pocket, Readwise, Calm — products that serve attention well)

We don't sell to: gambling, crypto, dropshipping, attention-traps, anything that feels like Instagram.

### 3.3 Pricing
- Self-serve dashboard for small advertisers (post-launch).
- Direct sales for institutional partners ($25k–$200k annual commitments).
- CPM model with auction layer: floor $8 CPM at launch, target $20–$40 CPM at 100k DAU as targeting data matures.
- Capping: max 1 sponsored card per 15 cards, max 3 per session per user. Less is more — too many ads kills the brand.

### 3.4 Targeting
Just two dimensions to start:
1. **Topic match.** A museum sponsors "history" and "art" categories. A podcast about space sponsors "space" and "science."
2. **Geography.** Country + region for institutions that have physical venues.

We deliberately do *not* offer demographic targeting in v1 — keeps us out of GDPR/CCPA's hardest territory and signals brand values.

### 3.5 Economics (illustrative)
At 100k DAU, ~5 sponsored impressions per user per day = 500k daily impressions = ~15M monthly.
- At $20 CPM: $300k/month gross. After ~30% platform overhead, ~$200k/mo net.

At 1M DAU: roughly 10× the above. This is the scale revenue stream.

## 4. Stream 3: B2B / EdTech licensing

### 4.1 The product
A white-label or co-branded version of the app for:
- **K–12 schools / districts** — a "ten minutes of educational scrolling" tool. Curated content by age range. Teacher dashboards.
- **Universities / libraries** — discovery layer on top of academic databases. We offer the consumer version *plus* curated subject-area collections.
- **Corporate L&D** — micro-learning for distributed teams. Especially valuable for onboarding, "company knowledge," and continuous-learning programs.
- **Museums** — branded micro-experience that drives visits. ("This is what's in our collection — come see it in person.")

### 4.2 Why it works
- The category we're competing in (corporate micro-learning) is huge — Cornerstone, Degreed, EdCast, etc. — and none of them have a *consumer-grade* product. We do.
- Our consumer brand is the marketing channel for B2B. School librarians will see students using the app and ask their districts to license it.
- Our content cost stays $0 (still Wikipedia + curated additions).

### 4.3 Pricing
- K–12: $3–$5/student/year, volume discounted, district contracts.
- Higher ed: $1–$2/student/year (libraries cover it).
- Corporate L&D: $8–$15/employee/year, tier-based features.
- Museums: $25k–$150k annual flat fee, mostly for branding + analytics.

### 4.4 Why this is defensible
- B2B contracts are multi-year and sticky.
- Per-seat pricing scales without proportional infra cost.
- Once we're inside one big school district, the renewal economics fund consumer growth indefinitely.

### 4.5 Sales motion
- Year 1: founder-led sales. Target 5–10 pilots (libraries + small districts + 1 museum).
- Year 2: hire 2 K–12 reps + 1 enterprise rep. Build self-serve onboarding for small orgs.
- Year 3: channel partnerships (Follett, Mackin, Schoology integrations).

## 5. Revenue projections (illustrative, optimistic-conservative midpoint)

| Year | MAU | Affiliate $ | Sponsored $ | B2B $ | Total |
|---|---|---|---|---|---|
| 1 | 50k | $30k | $60k | $80k (3 pilot contracts) | **$170k** |
| 2 | 500k | $400k | $900k | $750k | **$2.05M** |
| 3 | 2M | $1.8M | $5M | $4M | **$10.8M** |
| 4 | 5M | $5M | $14M | $10M | **$29M** |

These are scenarios, not forecasts. The big knobs are (a) DAU/MAU ratio, (b) "Go deeper" tap rate, (c) sponsor CPM evolution, and (d) close rate on B2B pilots.

## 6. Costs we don't pay (and one we do)

We don't pay for content (Wikipedia is free, CC-BY-SA).
We don't pay App Store / Play Store taxes — none of our revenue streams are digital in-app purchases.
We don't have a creator-revenue-share line item (there are no creators).
We don't pay influencer marketing in year 1 (we lean on the viral demo loop).

What we *do* pay App Store / Play Store: ~$99/yr Apple Developer Program + $25 one-time Google Play Console. Trivial.

**The one we do pay:** a meaningful percentage of revenue donated to the Wikimedia Foundation. Initial pledge: **5% of net revenue, capped at $1M/year** for first 3 years, escalating thereafter. This is part fairness, part marketing, part legal insurance — Wikimedia's response to commercial use is much friendlier when you're a financial supporter.

## 7. Unit economics (rough)

A user is worth about:
- **$0.05/month** at MVP (mostly affiliate)
- **$0.50/month** at 100k DAU (sponsored kicks in)
- **$2–$3/month** at scale (B2B inflates this via licensing per-seat math)

CAC target: well under $1 per acquired user, hit primarily via:
- Viral demo (the same loop that made the X post go viral)
- TikTok/Reels creator partnerships ("learn weird Wikipedia facts" creators are everywhere)
- SEO on long-tail article URLs (every article URL is indexable)
- App Store + Play Store presence — ASO is a major consumer-app acquisition channel

## 8. Marketing & growth philosophy

The product *is* the marketing in this category. Three flywheels:

1. **Share moments.** Built-in shareable formats: "Rabbit hole of the day," "Today's 5 cards," screenshot-friendly hooks. Native share sheets on both platforms. Every share = free acquisition.
2. **Universal Links / App Links.** Any shared article URL opens directly in the app if installed; falls back to the marketing site if not. Friction-free install funnel from any share.
3. **Creator economy parallel.** TikTok creators already make "Wikipedia rabbit hole" content. We give them a tool. ("This is the app I use" + affiliate kickback for creators.)

ASO (App Store Optimization) gets a dedicated owner from month 3 — both stores are major acquisition channels for consumer apps. Key levers: keyword in title/subtitle, screenshot sequence storytelling, reviews velocity, and category placement.

Paid acquisition becomes a tuning channel after $10k MRR, never the primary engine.

---

*Next: `06-roadmap-risks.md` covers timing, milestones, and what could kill us.*
