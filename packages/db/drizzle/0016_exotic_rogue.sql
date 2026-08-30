CREATE TYPE "public"."page_review_order" AS ENUM('page_number', 'scan');--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "review_order" "page_review_order";