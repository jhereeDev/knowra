-- Required Postgres extensions. Safe to re-run.
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE TABLE "affiliate_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" bigint NOT NULL,
	"provider" text,
	"title" text,
	"url" text,
	"rank" integer
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"wiki_id" text NOT NULL,
	"slug" text NOT NULL,
	"lang" text DEFAULT 'en',
	"title" text NOT NULL,
	"subtitle" text,
	"era_label" text,
	"hook" text,
	"summary" text,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"hero_image_id" bigint,
	"pageviews_30d" integer DEFAULT 0,
	"quality_score" real DEFAULT 0,
	"embedding" vector(1536),
	"status" text DEFAULT 'ready',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "articles_wiki_id_unique" UNIQUE("wiki_id"),
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"collection_id" uuid NOT NULL,
	"article_id" bigint NOT NULL,
	"added_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "collection_items_collection_id_article_id_pk" PRIMARY KEY("collection_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_seen_at" timestamp with time zone DEFAULT now(),
	"embedding" vector(1536)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"device_id" uuid NOT NULL,
	"user_id" uuid,
	"article_id" bigint NOT NULL,
	"event_type" text NOT NULL,
	"dwell_ms" integer,
	"occurred_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_url" text NOT NULL,
	"cdn_url_720" text,
	"cdn_url_1080" text,
	"cdn_url_1440" text,
	"blurhash" text,
	"width" integer,
	"height" integer,
	"attribution" text,
	"nsfw" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "sponsored_cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"partner_id" uuid NOT NULL,
	"title" text,
	"hook" text,
	"image_url" text,
	"cta_url" text,
	"targeting_categories" text[],
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"daily_cap" integer,
	"per_user_cap" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext",
	"name" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"digest_time" time,
	"topic_prefs" text[] DEFAULT '{}'::text[],
	"lang" text DEFAULT 'en',
	"embedding" vector(1536),
	"embedding_updated_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_hero_image_id_images_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."images"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_articles_quality" ON "articles" USING btree ("quality_score" DESC NULLS LAST) WHERE "articles"."status" = 'ready';--> statement-breakpoint
CREATE INDEX "idx_articles_categories" ON "articles" USING gin ("categories");--> statement-breakpoint
CREATE INDEX "idx_articles_embedding" ON "articles" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_events_user_time" ON "events" USING btree ("user_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_events_article" ON "events" USING btree ("article_id");