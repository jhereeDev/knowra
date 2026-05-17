ALTER TABLE "images" ADD COLUMN "dominant_color" text;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_source_url_unique" UNIQUE("source_url");