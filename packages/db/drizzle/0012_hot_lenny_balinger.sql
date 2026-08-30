ALTER TABLE "pages" ADD COLUMN "import_session_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "import_position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pages_import_session_position_unique" ON "pages" USING btree ("import_session_id","import_position");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_import_position_non_negative" CHECK ("pages"."import_position" >= 0);