ALTER TABLE "cards" ADD COLUMN "introduced_at" timestamp with time zone;--> statement-breakpoint
-- A card that has already been answered has been met, whatever the answer was,
-- so it keeps its place in the queue instead of being sent back to the
-- learning pass. Cards never answered stay null and are introduced properly.
UPDATE "cards" SET "introduced_at" = "last_reviewed_at" WHERE "last_reviewed_at" IS NOT NULL;
