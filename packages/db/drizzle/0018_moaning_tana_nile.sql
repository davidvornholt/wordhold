ALTER TABLE "entry_examples" ADD COLUMN "audio_profile" text;--> statement-breakpoint
ALTER TABLE "entry_examples" ADD COLUMN "audio_path" text;--> statement-breakpoint
ALTER TABLE "entry_examples" ADD CONSTRAINT "entry_examples_audio_complete" CHECK (("entry_examples"."audio_profile" is null) = ("entry_examples"."audio_path" is null));