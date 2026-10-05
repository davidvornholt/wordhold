ALTER TYPE "public"."ai_provider" ADD VALUE 'transcribe';--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "audio_seconds" integer;