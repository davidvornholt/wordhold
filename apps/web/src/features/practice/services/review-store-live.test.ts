import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { Database } from '@wordhold/db/client';
import { replayReviews } from '@wordhold/db/fsrs';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { cards } from '@wordhold/db/schema/practice';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import {
  dueEntryId,
  fixtureNow,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { StaleAnswerSubmissionError } from '../errors/practice-errors';
import { PracticeReviewStore } from './review-store';
import {
  makeReviewInput,
  runReviewTest,
} from './review-store-live-test-support';

type CardIdentity = {
  readonly id: string;
  readonly entryId: string;
  readonly direction: AnswerDirection;
};

const acceptedVerdict: JudgeVerdictData = {
  correct: true,
  acceptAsAlternative: true,
  otherWording: false,
  meaning: { ok: true, note: null },
  grammar: { ok: true, note: null },
  idiomaticity: { ok: true, note: null },
  spelling: { ok: true, note: null },
  intendedConstruction: { ok: true, note: null },
  explanation: 'Passt.',
};

describe('PracticeReviewStore introduction contract', () => {
  // A hand-picked selection is no exception: a card is learned or skipped
  // before it is asked.
  it.each(['scheduled', 'drill'] as const)(
    'rejects an unintroduced card in %s practice without changing practice state',
    async (mode) => {
      await Effect.runPromise(
        withMigratedTestDatabase((database) => {
          const databaseLayer = testDatabaseLayer(database.url);
          const reviewLayer = PracticeReviewStore.live.pipe(
            Layer.provide(databaseLayer),
          );
          return Effect.gen(function* () {
            yield* seedIntroducedCardFixture;
            const sql = yield* Database;
            const store = yield* PracticeReviewStore;
            const [identity] = yield* sql<CardIdentity>`
            select id, entry_id as "entryId", direction
            from cards where introduced_at is null
            order by direction limit 1
          `;
            if (identity === undefined) {
              return yield* Effect.die('Missing unintroduced card fixture.');
            }

            const submission = yield* store.findSubmission(identity.id, 0);
            expect(submission).toBeUndefined();

            const card: typeof cards.$inferSelect = {
              ...identity,
              introducedAt: null,
              state: 'new',
              dueAt: null,
              stability: null,
              stabilityFast: null,
              difficulty: null,
              reps: 0,
              lapses: 0,
              scheduledDays: 0,
              learningSteps: 0,
              lastReviewedAt: null,
              revision: 0,
            };
            const result = yield* store
              .commit({
                card,
                expectedRevision: 0,
                rating: ratings.good,
                reviewedAt: fixtureNow,
                outcome: { method: 'judge', verdict: acceptedVerdict },
                answer: 'nouveau',
                elapsedMs: 1000,
                mode,
                entryId: identity.entryId,
                direction: identity.direction,
                normalizedAnswer: 'nouveau',
                gradedTexts: { targetText: 'nouveau', nativeText: 'neu' },
                examRoundId: null,
              })
              .pipe(Effect.result);
            const failure =
              result._tag === 'Failure' ? result.failure : undefined;
            expect(failure).toBeInstanceOf(StaleAnswerSubmissionError);

            const [stored] = yield* sql<{
              readonly state: string;
              readonly revision: number;
              readonly introducedAt: Date | null;
            }>`
            select state, revision, introduced_at as "introducedAt"
            from cards where id = ${identity.id}
          `;
            const [counts] = yield* sql<{
              readonly reviews: number;
              readonly alternatives: number;
            }>`
            select
              (select count(*)::int from reviews) as reviews,
              (select count(*)::int from accepted_answers) as alternatives
          `;
            expect(stored).toEqual({
              state: 'new',
              revision: 0,
              introducedAt: null,
            });
            expect(counts).toEqual({ reviews: 0, alternatives: 0 });
          }).pipe(Effect.provide(reviewLayer), Effect.provide(databaseLayer));
        }),
      );
    },
  );
});

// The previous app version keeps answering during a deploy and after a roll
// back, so a card can reach this app with FSRS-6 memory after the migration's
// rebuild. Its stored due date is FSRS-6's; the rebuilt one is weeks later.
const fsrs6History = [
  { reviewedAt: new Date('2026-08-01T12:00:00.000Z'), rating: ratings.good },
  { reviewedAt: new Date('2026-08-02T12:00:00.000Z'), rating: ratings.good },
  { reviewedAt: new Date('2026-08-09T12:00:00.000Z'), rating: ratings.good },
] as const;

describe('PracticeReviewStore FSRS-6 memory', () => {
  it.each([
    ['a wrong answer', false, true],
    ['an early correct answer', true, false],
  ] as const)(
    'rebuilds the card from its answers before scheduling %s',
    async (_answer, correct, advanced) => {
      await runReviewTest(
        Effect.gen(function* () {
          const sql = yield* Database;
          const store = yield* PracticeReviewStore;
          const [card] = yield* sql<{ readonly id: string }>`
            update cards set stability_fast = null
            where entry_id = ${dueEntryId} and direction = 'to_target'
            returning id
          `;
          for (const review of fsrs6History) {
            yield* sql`
              insert into reviews (card_id, reviewed_at, rating, answer_text)
              values (${card?.id}, ${review.reviewedAt}, ${review.rating}, 'souvenir')
            `;
          }
          const input = yield* makeReviewInput({
            entryId: dueEntryId,
            direction: 'to_target',
            answer: 'souvenir',
            correct,
          });

          const committed = yield* store.commit(input);
          const [stored] = yield* sql`
            select state, due_at as "dueAt", stability,
              stability_fast as "stabilityFast", difficulty, reps, lapses,
              scheduled_days as "scheduledDays",
              learning_steps as "learningSteps",
              last_reviewed_at as "lastReviewedAt", revision
            from cards where id = ${input.card.id}
          `;
          expect(committed.schedule.advanced).toBe(advanced);
          expect(stored).toEqual({
            ...replayReviews([
              ...fsrs6History,
              { reviewedAt: input.reviewedAt, rating: input.rating },
            ]),
            revision: 1,
          });
        }),
      );
    },
  );
});
