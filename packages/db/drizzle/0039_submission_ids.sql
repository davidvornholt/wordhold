ALTER TABLE "members" ADD COLUMN "submission_id" uuid;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "submission_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "members_submission_id" ON "members" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exams_course_submission_id" ON "exams" USING btree ("course_id","submission_id");