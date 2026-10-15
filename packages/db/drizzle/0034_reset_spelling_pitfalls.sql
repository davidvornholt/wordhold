-- Pitfalls are now named only where the spelling cannot be derived from the
-- sound by the rules a student knows, and they mark the whole entry rather
-- than its affected word. Every stored pitfall is prepared again the next
-- time its word is shown.
UPDATE "entries" SET "spelling_pitfalls" = NULL WHERE "spelling_pitfalls" IS NOT NULL;
