-- Translation verdicts now record whether an answer is another wording. Older
-- verdicts no longer match the judge's cache identity and cannot be decoded.
-- Deleting them lets an answer rejected before the deploy report a stale
-- assessment instead of a read failure.
DELETE FROM "judge_cache" WHERE "verdict" ? 'correct' AND NOT "verdict" ? 'otherWording';
