import { z } from 'zod';

// Raw shape returned by Wikipedia's REST summary endpoint.
// Spec: https://en.wikipedia.org/api/rest_v1/#/Page_content/get_page_summary__title_
// We model only the fields we consume; unknown fields pass through.
export const wikiImageSchema = z.object({
  source: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const wikiSummarySchema = z
  .object({
    type: z.string(),
    title: z.string(),
    displaytitle: z.string().optional(),
    pageid: z.number().int(),
    extract: z.string().optional().default(''),
    extract_html: z.string().optional(),
    description: z.string().optional(),
    description_source: z.string().optional(),
    lang: z.string().optional(),
    timestamp: z.string().optional(),
    thumbnail: wikiImageSchema.optional(),
    originalimage: wikiImageSchema.optional(),
    content_urls: z
      .object({
        desktop: z.object({ page: z.string().url() }),
        mobile: z.object({ page: z.string().url() }),
      })
      .optional(),
  })
  .passthrough();

export type WikiSummary = z.infer<typeof wikiSummarySchema>;

// Normalized card we serve to clients. This is the contract apps depend on.
export const cardImageSchema = z.object({
  url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  // Hex color (#rrggbb) sampled from the image; the client paints this as
  // a background under the photo while it streams in. Optional because
  // extraction can fail (slow network, unsupported format).
  dominantColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
});

export const cardSchema = z.object({
  // Local DB row id (bigint, serialized as string to survive JSON safely).
  // This is what events.article_id references — clients must echo it back.
  articleId: z.string(),
  wikiId: z.string(),
  lang: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  hook: z.string(), // Currently the Wikipedia extract; will be LLM-generated later.
  image: cardImageSchema.nullable(),
  // Topic tags surfaced from `articles.categories` — derived from the
  // article's short description via lib/classify.ts. May be empty.
  categories: z.array(z.string()).default([]),
  wikipediaUrl: z.string().url(),
  attribution: z.string(), // CC-BY-SA, per Wikimedia ToS
  fetchedAt: z.string().datetime(),
});

export type Card = z.infer<typeof cardSchema>;

export const randomCardResponseSchema = z.object({
  card: cardSchema,
});

export type RandomCardResponse = z.infer<typeof randomCardResponseSchema>;

export const cardBatchResponseSchema = z.object({
  cards: z.array(cardSchema),
});

export type CardBatchResponse = z.infer<typeof cardBatchResponseSchema>;

// Search result — lightweight (no upsert, no hook generation), used by
// the search modal's autocomplete list.
export const searchResultSchema = z.object({
  wikiId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  thumbnailUrl: z.string().url().nullable(),
});
export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
});
export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
