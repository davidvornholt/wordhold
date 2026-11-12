CREATE TABLE "exam_entries" (
	"exam_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	CONSTRAINT "exam_entries_exam_id_entry_id_pk" PRIMARY KEY("exam_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "exam_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"directions" "answer_direction"[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "exams_directions_non_empty" CHECK (cardinality("exams"."directions") > 0)
);
--> statement-breakpoint
CREATE TABLE "exam_round_cards" (
	"round_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	CONSTRAINT "exam_round_cards_round_id_card_id_pk" PRIMARY KEY("round_id","card_id")
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "exam_round_id" uuid;--> statement-breakpoint
ALTER TABLE "exam_entries" ADD CONSTRAINT "exam_entries_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_entries" ADD CONSTRAINT "exam_entries_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_rounds" ADD CONSTRAINT "exam_rounds_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_round_cards" ADD CONSTRAINT "exam_round_cards_round_id_exam_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."exam_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_round_cards" ADD CONSTRAINT "exam_round_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_entries_entry_id" ON "exam_entries" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "exam_rounds_exam_id" ON "exam_rounds" USING btree ("exam_id","started_at");--> statement-breakpoint
CREATE INDEX "exams_course_id" ON "exams" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "exam_round_cards_card_id" ON "exam_round_cards" USING btree ("card_id");--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_exam_round_id_exam_rounds_id_fk" FOREIGN KEY ("exam_round_id") REFERENCES "public"."exam_rounds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_exam_round_id" ON "reviews" USING btree ("exam_round_id","card_id","reviewed_at") WHERE "reviews"."exam_round_id" is not null;