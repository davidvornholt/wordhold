CREATE TABLE "import_session_tombstones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"abandoned_at" timestamp with time zone DEFAULT now() NOT NULL
);
