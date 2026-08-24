import { createServerFn } from '@tanstack/react-start';
import { courses } from '@wordhold/db/schema/courses';
import { acceptedAnswers, entries } from '@wordhold/db/schema/entries';
import { cards, reviews } from '@wordhold/db/schema/practice';
import { and, eq } from 'drizzle-orm';
import { Schema } from 'effect';
import { requireSession } from '../auth/require-session';
import { db } from '../db/server';
import { normalizeAnswer } from '../grading/normalize';
import { englishNames } from '../languages';
import { applyRating } from './fsrs';
import { judgeWithCache } from './judge-cache';
import { deriveRating, type GradeOutcome, isCorrect } from './rating';

const SubmitPayload = Schema.Struct({
  cardId: Schema.UUID,
  answer: Schema.String,
  elapsedMs: Schema.optional(Schema.Number),
});

export const submitAnswer = createServerFn({ method: 'POST' })
  .validator((input: unknown) => Schema.decodeUnknownSync(SubmitPayload)(input))
  .handler(async ({ data }) => {
    await requireSession();
    const [row] = await db
      .select()
      .from(cards)
      .innerJoin(entries, eq(cards.entryId, entries.id))
      .innerJoin(courses, eq(entries.courseId, courses.id))
      .where(eq(cards.id, data.cardId));
    if (row === undefined) {
      throw new Error('Karte nicht gefunden.');
    }
    const { direction } = row.cards;
    const accepted = await db
      .select()
      .from(acceptedAnswers)
      .where(
        and(
          eq(acceptedAnswers.entryId, row.entries.id),
          eq(acceptedAnswers.direction, direction),
        ),
      );
    const normalized = normalizeAnswer(data.answer);
    const expectedAnswers = accepted.map((answer) => answer.text);

    // Fast path: a deterministic match never touches a model.
    let outcome: GradeOutcome;
    if (accepted.some((answer) => answer.normalized === normalized)) {
      outcome = { method: 'exact' };
    } else {
      const verdict = await judgeWithCache({
        entryId: row.entries.id,
        direction,
        normalizedAnswer: normalized,
        input: {
          direction,
          targetLanguage: englishNames[row.courses.targetLanguage],
          prompt:
            direction === 'to_target'
              ? row.entries.nativeText
              : row.entries.targetText,
          expectedAnswers,
          givenAnswer: data.answer,
          entryType: row.entries.type,
        },
      });
      if (verdict === null) {
        // Leave the card untouched rather than penalizing the schedule for
        // an unreachable judge.
        return {
          graded: false as const,
          expectedAnswers,
          message:
            'Der KI-Prüfer ist gerade nicht erreichbar; die Antwort wurde nicht gewertet.',
        };
      }
      outcome = { method: 'judge', verdict };
      if (verdict.acceptAsAlternative) {
        await db
          .insert(acceptedAnswers)
          .values({
            entryId: row.entries.id,
            direction,
            text: data.answer.trim(),
            normalized,
            source: 'judge',
          })
          .onConflictDoNothing();
      }
    }

    const correct = isCorrect(outcome);
    const rating = deriveRating(outcome, data.elapsedMs ?? null);
    const now = new Date();
    await db
      .update(cards)
      .set(applyRating(row.cards, rating, now))
      .where(eq(cards.id, row.cards.id));
    await db.insert(reviews).values({
      cardId: row.cards.id,
      rating,
      answerText: data.answer,
      grading: outcome,
      elapsedMs: data.elapsedMs ?? null,
    });
    return {
      graded: true as const,
      correct,
      rating,
      expectedAnswers,
      explanation:
        outcome.method === 'judge' ? outcome.verdict.explanation : null,
      acceptedAsAlternative:
        outcome.method === 'judge' && outcome.verdict.acceptAsAlternative,
    };
  });
