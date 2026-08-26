ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
-- Rows written before this column exists were all linked through GitHub OAuth,
-- which better-auth names with the synthetic `local:oauth:<provider>` issuer.
UPDATE "account" SET "issuer" = 'local:oauth:' || "provider_id" WHERE "issuer" IS NULL;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_idx" ON "account" USING btree ("issuer","account_id");
