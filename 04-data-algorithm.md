# 04 — Data Model & Recommendation Algorithm

This document defines the data layer and the personalization logic. Pair with `03-technical-architecture.md` for the surrounding infrastructure.

---

## 1. Data model (Postgres)

We design for a feed-first workload: very read-heavy on articles, very write-heavy on events. Hot tables go to Redis; everything else lives in Postgres.

### 1.1 Schema overview

```sql
-- Articles: one row per Wikipedia article we've ingested.
CREATE TABLE articles (
  id              BIGSERIAL PRIMARY KEY,
  wiki_id         TEXT UNIQUE NOT NULL,         -- Wikipedia page ID
  slug            TEXT UNIQUE NOT NULL,
  lang            TEXT DEFAULT 'en',
  title           TEXT NOT NULL,
  subtitle        TEXT,                          -- e.g. "American business jet"
  era_label       TEXT,                          -- e.g. "1964"
  hook            TEXT,                          -- 2-sentence AI hook (≤240 chars)
  summary         TEXT,                          -- ~300-word summary
  categories      TEXT[] NOT NULL DEFAULT '{}',
  hero_image_id   BIGINT REFERENCES images(id),
  pageviews_30d   INT DEFAULT 0,
  quality_score   REAL DEFAULT 0,                -- 0..1, derived from word count, refs, image
  embedding       VECTOR(1536),                  -- pgvector
  status          TEXT DEFAULT 'ready',          -- ready / draft / blocked
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_articles_quality ON articles (quality_score DESC) WHERE status = 'ready';
CREATE INDEX idx_articles_categories ON articles USING GIN (categories);
CREATE INDEX idx_articles_embedding ON articles USING ivfflat (embedding vector_cosine_ops);

-- Images: deduplicated, normalized URLs.
CREATE TABLE images (
  id              BIGSERIAL PRIMARY KEY,
  source_url      TEXT NOT NULL,                 -- original on Commons
  cdn_url_720     TEXT,
  cdn_url_1080    TEXT,
  cdn_url_1440    TEXT,
  blurhash        TEXT,
  width           INT,
  height          INT,
  attribution     TEXT,                          -- author + license
  nsfw            BOOLEAN DEFAULT FALSE
);

-- Users: lightweight, magic-link based.
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT UNIQUE,
  name            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  digest_time     TIME,                          -- preferred daily digest time
  topic_prefs     TEXT[] DEFAULT '{}',
  lang            TEXT DEFAULT 'en',
  embedding       VECTOR(1536),                  -- user interest vector
  embedding_updated_at TIMESTAMPTZ
);

-- Anonymous users get a device row; merged into users on sign-up.
CREATE TABLE devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),     -- nullable until linked
  created_at      TIMESTAMPTZ DEFAULT now(),
  last_seen_at    TIMESTAMPTZ DEFAULT now(),
  embedding       VECTOR(1536)
);

-- Events: append-only firehose.
CREATE TABLE events (
  id              BIGSERIAL PRIMARY KEY,
  device_id       UUID NOT NULL,
  user_id         UUID,
  article_id      BIGINT NOT NULL REFERENCES articles(id),
  event_type      TEXT NOT NULL,                 -- impression / swipe_up / swipe_back / save / share / go_deeper / quick_skip
  dwell_ms        INT,                            -- time spent on card
  occurred_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_user_time ON events (user_id, occurred_at DESC);
CREATE INDEX idx_events_article ON events (article_id);

-- Saves & collections.
CREATE TABLE collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  is_public       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE collection_items (
  collection_id   UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  article_id      BIGINT NOT NULL REFERENCES articles(id),
  added_at        TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (collection_id, article_id)
);

-- Sponsored cards & affiliate partners.
CREATE TABLE sponsored_cards (
  id              UUID PRIMARY KEY,
  partner_id      UUID NOT NULL,
  title           TEXT, hook TEXT, image_url TEXT, cta_url TEXT,
  targeting_categories TEXT[],
  starts_at       TIMESTAMPTZ, ends_at TIMESTAMPTZ,
  daily_cap       INT,
  per_user_cap    INT DEFAULT 1
);

CREATE TABLE affiliate_links (
  id              UUID PRIMARY KEY,
  article_id      BIGINT NOT NULL REFERENCES articles(id),
  provider        TEXT,                          -- amazon / coursera / masterclass / ...
  title           TEXT,
  url             TEXT,
  rank            INT
);
```

### 1.2 Why this shape

- **Append-only events** make analytics simple and keep writes fast.
- **Vector columns directly on `articles` & `users`** lets us query "top-N similar articles to user X" in a single SQL call (pgvector).
- **`categories` as an array** is messy in theory but pragmatic — Wikipedia's category graph is a horror show; we tag with a smaller curated set of ~50 top-level themes.
- **`quality_score`** is an editorial gatekeeper. Stub articles never make it into the feed.

## 2. The "Random" feed (no personalization)

This is the cold-start experience. It must feel curated even though it's not.

Algorithm:
1. Pool = all articles where `status = 'ready'` AND `quality_score > 0.6`.
2. Weight selection by **diversity** — within a session, no two consecutive cards share a primary category.
3. Light bias toward "evergreen-popular" — articles with `pageviews_30d` in the top 10% are 2× more likely.
4. Hard filter: don't repeat any article a device has seen in the last 30 days.

Implementation: pre-compute a "Random pool of the day" — 5000 cards — in Redis at 4am UTC. Serve from that pool, removing seen-by-device IDs at request time. This keeps Random super fast and avoids per-request DB load.

## 3. The "For You" feed (personalized)

This is where retention is won or lost.

### 3.1 User vector

Each user (and each anonymous device) has a 1536-dim embedding that represents their interests. We compute it as a weighted sum of the embeddings of articles they've positively engaged with:

```
user_vec = Σ (engagement_weight × article_vec) / total_weight

engagement_weight:
  share          = 6
  save           = 5
  go_deeper      = 4
  long_dwell     = 3   (dwell_ms > 8000)
  swipe_up_only  = 1
  quick_skip     = -2  (dwell_ms < 1500)
```

Update cadence:
- **Real-time-ish:** every 5 minutes, recompute for users active in the last 24h (batch job).
- **Cold users:** zero-vector → fall back to topic preferences → fall back to Random.

### 3.2 Candidate generation

Three sources, ranked together:

| Source | Share | Logic |
|---|---|---|
| **Vector similarity** | 55% | Top-200 articles closest to user vector, with diversity penalty. |
| **Collaborative filtering** | 25% | Articles liked by users with similar vectors that this user hasn't seen. |
| **Exploration** | 15% | Random high-quality articles outside the user's current interest cluster. Critical for keeping the feed surprising. |
| **Editorial picks** | 5% | Hand-curated cards from our editorial team, surfaced to all matching users. |

The exploration band is crucial. Without it, the feed collapses into a narrow rabbit hole and gets boring. Same problem TikTok solved by injecting "novel" content.

### 3.3 Ranking signals

After candidate generation, we rank with a logistic-regression-style score:

```
score = 0.40 × similarity
      + 0.20 × normalized(article.quality_score)
      + 0.15 × normalized(article.pageviews_30d)
      + 0.10 × image_quality_factor
      + 0.10 × time_decay_since_last_shown
      − 0.05 × overlap_with_recent_categories
```

Coefficients tuned with a tiny offline replay of held-out user sessions every 2 weeks. Easy to upgrade to a gradient-boosted model later.

### 3.4 Re-ranking for diversity & freshness

After ranking:
- No two consecutive cards from the same primary category.
- At most 3 cards from the same category in any 10-card window.
- Inject one **exploration** card every 6 slots.
- Inject one **sponsored** card every ~15 slots (max), only if a relevant one fits the user's category window.

## 4. The "Today" feed

Simpler. Pulls from Wikipedia's `feed/onthisday/all/{MM}/{DD}` endpoint, augmented with our quality filter & hero image pipeline. Mixed in date order: events → births → deaths, with quality filtering applied uniformly.

## 5. Cold-start strategy

The first 5 minutes determine whether a user comes back. Cold-start logic:

1. **Session 1, first 3 cards:** hand-picked "almost universally fascinating" cards (we maintain a list of ~50: e.g., Voyager Golden Record, Antikythera mechanism, Operation Mincemeat, the immortal jellyfish). These over-perform on every demographic in early testing — they create the "huh, I never knew that" moment.
2. **Cards 4–10:** Random feed, biased to popular & visually striking.
3. **Card 11+:** if topic prefs were chosen, weight toward them; otherwise continue Random with growing personalization weight.

## 6. Event ingestion

The client batches events every 5 seconds or 20 events (whichever first) and POSTs to `/api/event`. The endpoint:
- Validates schema
- Writes to Postgres (`events` table, append-only)
- Pushes to a Redis stream for the recommendation service to consume
- Returns 204 (fire-and-forget from the client's perspective)

Events should never block the swipe. The endpoint targets < 50ms response time.

## 7. Spaced repetition (Quiz cards)

For the "Did I learn?" quiz feature:
- Each fact a user encounters (extracted from the hook + summary) is logged in a `learned_facts` table.
- Quiz cards select from facts the user saw 1, 3, 7, or 14 days ago (SuperMemo-lite intervals).
- Correct answers extend the interval; incorrect answers reset it.
- Hidden value: this gives us *retention beyond the app* — users actually remember what they read, which they tell their friends about, which drives word-of-mouth.

## 8. Privacy & compliance considerations for the data model

- **Right to delete:** user delete cascades to events. Anonymized aggregates stay (no personal IDs).
- **Right to export:** one endpoint dumps a user's events + collections + topic prefs as JSON.
- **Minimal retention:** raw events older than 18 months get aggregated and the raw rows dropped.
- **No third-party trackers** on the feed surface. PostHog runs first-party (subdomain) and respects DNT.

## 9. Open algorithmic questions

1. **Filter bubble risk.** Strong personalization → narrowing interests. Our 15% exploration band fights this but we should track *category entropy* per user and intervene if it collapses below a threshold.
2. **Cold-start in languages other than English.** Initial editorial picks lists need to be localized — not just translated, but culturally re-curated.
3. **Sensitive topics.** Articles about contemporary politics, current conflicts, etc. — do we surface or suppress? Initial answer: suppress current events (<30d old). Long-form history is fair game.
4. **Anti-gaming for sponsored cards.** Partners will try to push their content into the organic ranking via reverse-engineering. We never use sponsor signals in user vectors.

---

*Next: `05-monetization.md` covers how this becomes a business.*
