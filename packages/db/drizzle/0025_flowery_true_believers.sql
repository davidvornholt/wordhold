ALTER TYPE "public"."course_kind" ADD VALUE 'texts';--> statement-breakpoint
ALTER TABLE "courses" DROP CONSTRAINT "courses_terms_shape";--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_list_shape" CHECK ("courses"."kind" = 'language' or ("courses"."target_language" = "courses"."native_language" and "courses"."directions" = '{to_native}'::answer_direction[]));