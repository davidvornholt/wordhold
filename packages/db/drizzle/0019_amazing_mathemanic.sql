CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "units_course_name";--> statement-breakpoint
DROP INDEX "units_course_position";--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "book_id" uuid;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "books_course_name" ON "books" USING btree ("course_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "books_course_position" ON "books" USING btree ("course_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "books_id_course" ON "books" USING btree ("id","course_id");--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_book_course_books_id_course_fk" FOREIGN KEY ("book_id","course_id") REFERENCES "public"."books"("id","course_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "units_book_name" ON "units" USING btree ("book_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "units_book_position" ON "units" USING btree ("book_id","position");