CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "units_course_name" ON "units" USING btree ("course_id","name");--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "unit_id" uuid;--> statement-breakpoint
-- Vocabulary imported before units existed is grouped by the page it came from,
-- which is the closest thing to a chapter the stored data already has. The
-- page's own label is kept inside the name so the unit stays recognisable, and
-- the capture-order number keeps that name unique within its course.
WITH numbered AS (
  SELECT p."id" AS page_id,
         p."course_id" AS course_id,
         row_number() OVER (PARTITION BY p."course_id" ORDER BY p."captured_at", p."id") AS ordinal,
         NULLIF(btrim(p."label"), '') AS label
  FROM "pages" p
  WHERE EXISTS (SELECT 1 FROM "entries" e WHERE e."page_id" = p."id")
), labelled AS (
  SELECT page_id,
         course_id,
         ordinal,
         'Einheit ' || ordinal || COALESCE(' – ' || label, '') AS name
  FROM numbered
), created AS (
  INSERT INTO "units" ("course_id", "name", "position")
  SELECT course_id, name, ordinal - 1 FROM labelled
  RETURNING "id", "course_id", "name"
)
UPDATE "entries" e
SET "unit_id" = created."id"
FROM labelled
JOIN created ON created."course_id" = labelled.course_id AND created."name" = labelled.name
WHERE e."page_id" = labelled.page_id;--> statement-breakpoint
-- Entries whose page was deleted have no chapter to recover, so each affected
-- course gets one holding unit that sorts after the real ones.
WITH orphaned AS (
  SELECT DISTINCT "course_id" FROM "entries" WHERE "unit_id" IS NULL
), created AS (
  INSERT INTO "units" ("course_id", "name", "position")
  SELECT "course_id", 'Ohne Einheit', 1000 FROM orphaned
  RETURNING "id", "course_id"
)
UPDATE "entries" e
SET "unit_id" = created."id"
FROM created
WHERE e."course_id" = created."course_id" AND e."unit_id" IS NULL;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "unit_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;
