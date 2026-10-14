-- The judge used to accept synonyms into the target language and store them
-- as accepted answers, which grade without asking it again. It now accepts
-- only the textbook wording, so those answers would still count. A notation
-- variant among them is judged again on its next answer.
DELETE FROM "accepted_answers" WHERE "source" = 'judge' AND "direction" = 'to_target';
