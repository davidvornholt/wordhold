import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { Database } from '@wordhold/db/client';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { ReviewMode } from '@wordhold/db/schema/practice';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import { seedIntroducedCardFixture } from '../../../shared/testing/introduced-card-fixture';
import type { PersistReviewInput } from '../schemas/practice-models';
import { PracticeReviewStore } from './review-store';

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

type MakeReviewInputOptions = {
  readonly entryId: string;
  readonly direction: AnswerDirection;
  readonly answer: string;
  readonly mode?: ReviewMode;
  readonly reviewedAt?: Date;
};

export const makeReviewInput = ({
  entryId,
  direction,
  answer,
  mode = 'scheduled',
  reviewedAt = new Date('2026-08-20T12:01:00.000Z'),
}: MakeReviewInputOptions) =>
  Effect.gen(function* () {
    const sql = yield* Database;
    const store = yield* PracticeReviewStore;
    const rows = yield* sql<{ readonly id: string }>`
      select id from cards
      where entry_id = ${entryId} and direction = ${direction}
    `;
    const cardId = rows.at(0)?.id;
    if (cardId === undefined) {
      return yield* Effect.die('Expected the seeded card.');
    }
    const submission = yield* store.findSubmission(cardId, 0);
    if (submission === undefined) {
      return yield* Effect.die('Expected the seeded card revision.');
    }
    return {
      card: submission.card,
      expectedRevision: 0,
      rating: 3,
      reviewedAt,
      outcome: { method: 'judge', verdict: acceptedVerdict },
      answer,
      elapsedMs: 750,
      entryId,
      direction,
      normalizedAnswer: answer,
      mode,
    } satisfies PersistReviewInput;
  });

export const runReviewTest = <A, E>(
  test: Effect.Effect<A, E, Database | PracticeReviewStore>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return Effect.zipRight(seedIntroducedCardFixture, test).pipe(
        Effect.provide(
          PracticeReviewStore.live.pipe(Layer.provide(databaseLayer)),
        ),
        Effect.provide(databaseLayer),
      );
    }),
  );
