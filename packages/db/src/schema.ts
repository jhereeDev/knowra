import { sql } from 'drizzle-orm';
import {
  bigserial,
  bigint,
  boolean,
  customType,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  time,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

// Postgres CITEXT type — Drizzle doesn't ship a built-in; use a custom type.
const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'citext';
  },
});

// Postgres TEXT[] array helper — Drizzle exposes .array() on text().
// Kept inline below for clarity.

// =====================================================================
// Images — deduplicated, normalized URLs.
// =====================================================================
export const images = pgTable('images', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sourceUrl: text('source_url').notNull().unique(),
  cdnUrl720: text('cdn_url_720'),
  cdnUrl1080: text('cdn_url_1080'),
  cdnUrl1440: text('cdn_url_1440'),
  blurhash: text('blurhash'),
  dominantColor: text('dominant_color'), // hex like #1a2b3c — instant placeholder
  width: integer('width'),
  height: integer('height'),
  attribution: text('attribution'),
  nsfw: boolean('nsfw').default(false),
});

// =====================================================================
// Articles — one row per ingested Wikipedia article.
// =====================================================================
export const articles = pgTable(
  'articles',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    wikiId: text('wiki_id').notNull().unique(),
    slug: text('slug').notNull().unique(),
    lang: text('lang').default('en'),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    eraLabel: text('era_label'),
    hook: text('hook'),
    // Provenance: 'wikipedia' = raw extract; 'llm' = Claude-generated;
    // 'fallback' = LLM ran but couldn't produce a usable hook (so we
    // kept the extract — null means hook hasn't been processed yet).
    hookSource: text('hook_source'),
    summary: text('summary'),
    categories: text('categories').array().notNull().default(sql`'{}'::text[]`),
    heroImageId: bigint('hero_image_id', { mode: 'number' }).references(() => images.id),
    pageviews30d: integer('pageviews_30d').default(0),
    qualityScore: real('quality_score').default(0),
    embedding: vector('embedding', { dimensions: 1536 }),
    status: text('status').default('ready'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_articles_quality')
      .on(t.qualityScore.desc())
      .where(sql`${t.status} = 'ready'`),
    index('idx_articles_categories').using('gin', t.categories),
    index('idx_articles_embedding').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);

// =====================================================================
// Users — magic-link based.
// =====================================================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: citext('email').unique(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  digestTime: time('digest_time'),
  topicPrefs: text('topic_prefs').array().default(sql`'{}'::text[]`),
  lang: text('lang').default('en'),
  embedding: vector('embedding', { dimensions: 1536 }),
  embeddingUpdatedAt: timestamp('embedding_updated_at', { withTimezone: true }),
});

// =====================================================================
// Devices — anonymous users get a row; merged into users on sign-up.
// =====================================================================
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
  embedding: vector('embedding', { dimensions: 1536 }),
  // Expo push token (ExponentPushToken[xxxxx]). Nullable — populated
  // only after the user grants notification permission.
  expoPushToken: text('expo_push_token'),
  pushOptedInAt: timestamp('push_opted_in_at', { withTimezone: true }),
});

// =====================================================================
// Events — append-only firehose.
// =====================================================================
export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    deviceId: uuid('device_id').notNull(),
    userId: uuid('user_id'),
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .references(() => articles.id),
    eventType: text('event_type').notNull(),
    dwellMs: integer('dwell_ms'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_events_user_time').on(t.userId, t.occurredAt.desc()),
    index('idx_events_article').on(t.articleId),
  ],
);

// =====================================================================
// Collections + items — Saves UI.
// =====================================================================
export const collections = pgTable('collections', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const collectionItems = pgTable(
  'collection_items',
  {
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .references(() => articles.id),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.articleId] })],
);

// =====================================================================
// Monetization — sponsored cards + affiliate links.
// =====================================================================
export const sponsoredCards = pgTable('sponsored_cards', {
  id: uuid('id').primaryKey(),
  partnerId: uuid('partner_id').notNull(),
  title: text('title'),
  hook: text('hook'),
  imageUrl: text('image_url'),
  ctaUrl: text('cta_url'),
  targetingCategories: text('targeting_categories').array(),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  dailyCap: integer('daily_cap'),
  perUserCap: integer('per_user_cap').default(1),
});

export const affiliateLinks = pgTable('affiliate_links', {
  id: uuid('id').primaryKey(),
  articleId: bigint('article_id', { mode: 'number' })
    .notNull()
    .references(() => articles.id),
  provider: text('provider'),
  title: text('title'),
  url: text('url'),
  rank: integer('rank'),
});
