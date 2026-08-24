ALTER TABLE "cards" ADD COLUMN "scheduled_days" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "learning_steps" integer DEFAULT 0 NOT NULL;