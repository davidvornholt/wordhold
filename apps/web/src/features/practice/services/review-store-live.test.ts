import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { Database } from '@wordhold/db/client';
import type { AnswerDirection } from '@wordhold/db/schema/entries';
import type { cards } from '@wordhold/db/schema/practice';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import {
  fixtureNow,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { StaleAnswerSubmissionError } from '../errors/practice-errors';
import { PracticeReviewStore } from './review-store';

type CardIdentity = {
  readonly id: string;
  readonly entryId: string;
  readonly direction: AnswerDirection;
};

const acceptedVerdict: JudgeVerdictData = {
  correct: true,
  acceptAsAlternative: true,
  meaning: { ok: true, note: null },
  grammar: { ok: true, note: null },
  idiomaticity: { ok: true, note: null },
  spelling: { ok: true, note: null },
  intendedConstruction: { ok: true, note: null },
  explanation: 'Passt.',
};

describe('PracticeReviewStore introduction contract', () => {
  it('rejects an unintroduced card without changing practice state', async () => {
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
              entryId: identity.entryId,
              direction: identity.direction,
              normalizedAnswer: 'nouveau',
            })
            .pipe(Effect.either);
          const failure = result._tag === 'Left' ? result.left : undefined;
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
  });
});
