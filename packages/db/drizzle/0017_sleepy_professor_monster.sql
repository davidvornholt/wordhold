ALTER TABLE "pages" ADD COLUMN "review_position" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "pages_import_session_review_position_unique" ON "pages" USING btree ("import_session_id","review_position");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_review_position_non_negative" CHECK ("pages"."review_position" is null or "pages"."review_position" >= 0);