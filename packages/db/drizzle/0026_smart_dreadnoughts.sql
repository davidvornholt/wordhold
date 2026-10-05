CREATE TABLE "bible_verses" (
	"bible_id" uuid NOT NULL,
	"book" smallint NOT NULL,
	"chapter" smallint NOT NULL,
	"verse" smallint NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "bible_verses_bible_id_book_chapter_verse_pk" PRIMARY KEY("bible_id","book","chapter","verse"),
	CONSTRAINT "bible_verses_position" CHECK ("bible_verses"."book" between 1 and 66 and "bible_verses"."chapter" > 0 and "bible_verses"."verse" > 0)
);
--> statement-breakpoint
CREATE TABLE "bibles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bible_verses" ADD CONSTRAINT "bible_verses_bible_id_bibles_id_fk" FOREIGN KEY ("bible_id") REFERENCES "public"."bibles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bibles" ADD CONSTRAINT "bibles_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bibles_owner_abbreviation" ON "bibles" USING btree ("owner_id","abbreviation");