ALTER TABLE "entries" DROP CONSTRAINT "entries_unit_course_units_id_course_fk";
--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "unit_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "book_id" uuid;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_book_course_books_id_course_fk" FOREIGN KEY ("book_id","course_id") REFERENCES "public"."books"("id","course_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_unit_book_units_id_book_fk" FOREIGN KEY ("unit_id","book_id") REFERENCES "public"."units"("id","book_id") ON DELETE restrict ON UPDATE no action;