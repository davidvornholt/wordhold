import { createServerFn } from '@tanstack/react-start';
import { isAcceptedAlternative } from '@wordhold/ai/judge/schema';
import { courses } from '@wordhold/db/schema/courses';
import { acceptedAnswers, entries } from '@wordhold/db/schema/entries';
import { cards, reviews } from '@wordhold/db/schema/practice';
import { and, eq, sql } from 'drizzle-orm';
import { requireSession } from '../auth/require-session';
import { db } from '../db/server';
import { normalizeAnswer } from '../grading/normalize';
import { englishNames } from '../languages';
import { applyRating, type DerivedRating } from './fsrs';
import { judgeWithCache } from './judge-cache';
import { deriveRating, type GradeOutcome, isCorrect } from './rating';
import {
  commitGradedAnswer,
  StaleAnswerSubmissionError,
} from './review-commit';
import { decodeSubmitPayload } from './submission-schema';

type PersistReviewInput = {
  readonly card: typeof cards.$inferSelect;
  readonly expectedRevision: number;
  readonly rating: DerivedRating;
  readonly reviewedAt: Date;
  readonly outcome: GradeOutcome;
  readonly answer: string;
  readonly elapsedMs: number | null;
  readonly entryId: string;
  readonly direction: (typeof cards.$inferSelect)['direction'];
  readonly normalizedAnswer: string;
};

const persistReview = async (input: PersistReviewInput): Promise<void> =>
  commitGradedAnswer(
    async (work) =>
      db.transaction(async (tx) =>
        work({
          advanceCard: async () => {
            const [advanced] = await tx
              .update(cards)
              .set({
                ...applyRating(input.card, input.rating, input.reviewedAt),
                revision: sql`${cards.revision} + 1`,
              })
              .where(
                and(
                  eq(cards.id, input.card.id),
                  eq(cards.revision, input.expectedRevision),
                ),
              )
              .returning({ id: cards.id });
            return advanced !== undefined;
          },
          insertAcceptedAlternative: async () => {
            await tx
              .insert(acceptedAnswers)
              .values({
                entryId: input.entryId,
                direction: input.direction,
                text: input.answer.trim(),
                normalized: input.normalizedAnswer,
                source: 'judge',
              })
              .onConflictDoNothing();
          },
          insertReview: async () => {
            await tx.insert(reviews).values({
              cardId: input.card.id,
              rating: input.rating,
              answerText: input.answer,
              grading: input.outcome,
              elapsedMs: input.elapsedMs,
            });
          },
        }),
      ),
    input.outcome.method === 'judge' ? input.outcome.verdict : null,
  );

export const submitAnswer = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeSubmitPayload(input))
  .handler(async ({ data }) => {
    await requireSession();
    const [row] = await db
      .select()
      .from(cards)
      .innerJoin(entries, eq(cards.entryId, entries.id))
      .innerJoin(courses, eq(entries.courseId, courses.id))
      .where(and(eq(cards.id, data.cardId), eq(cards.revision, data.revision)));
    if (row === undefined) {
      throw new StaleAnswerSubmissionError(
        'Diese Karte wurde bereits beantwortet. Lade die Übung neu.',
      );
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
    }

    const correct = isCorrect(outcome);
    const rating = deriveRating(outcome, data.elapsedMs ?? null);
    const now = new Date();
    await persistReview({
      card: row.cards,
      expectedRevision: data.revision,
      rating,
      reviewedAt: now,
      outcome,
      answer: data.answer,
      elapsedMs: data.elapsedMs ?? null,
      entryId: row.entries.id,
      direction,
      normalizedAnswer: normalized,
    });
    return {
      graded: true as const,
      correct,
      rating,
      expectedAnswers,
      explanation:
        outcome.method === 'judge' ? outcome.verdict.explanation : null,
      acceptedAsAlternative:
        outcome.method === 'judge' && isAcceptedAlternative(outcome.verdict),
    };
  });
