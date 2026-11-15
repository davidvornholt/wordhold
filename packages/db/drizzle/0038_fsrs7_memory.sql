ALTER TABLE "cards" ALTER COLUMN "stability" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "difficulty" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "scheduled_days" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "stability_fast" double precision;