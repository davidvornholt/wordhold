CREATE TYPE "public"."review_mode" AS ENUM('scheduled', 'drill');--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "mode" "review_mode" DEFAULT 'scheduled' NOT NULL;