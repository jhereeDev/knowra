ALTER TABLE "devices" ADD COLUMN "expo_push_token" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "push_opted_in_at" timestamp with time zone;