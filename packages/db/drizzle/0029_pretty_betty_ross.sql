ALTER TYPE "public"."answer_direction" ADD VALUE 'to_synonym';--> statement-breakpoint
ALTER TYPE "public"."answer_direction" ADD VALUE 'to_antonym';--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "practises_related_words" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_directions_translations" CHECK ("courses"."directions" <@ '{to_target,to_native}'::answer_direction[]);