CREATE TYPE "public"."course_kind" AS ENUM('language', 'terms');--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "kind" "course_kind" DEFAULT 'language' NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "key_points" text[];--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_terms_shape" CHECK ("courses"."kind" = 'language' or ("courses"."target_language" = "courses"."native_language" and "courses"."directions" = '{to_native}'::answer_direction[]));