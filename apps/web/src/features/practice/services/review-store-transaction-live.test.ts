import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  dueEntryId,
  freshEntryId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { StaleAnswerSubmissionError } from '../errors/practice-errors';
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

const makeInput = (
  entryId: string,
  direction: 'to_target' | 'to_native',
  answer: string,
) =>
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
      reviewedAt: new Date('2026-08-20T12:01:00.000Z'),
      outcome: { method: 'judge', verdict: acceptedVerdict },
      answer,
      elapsedMs: 750,
      entryId,
      direction,
      normalizedAnswer: answer,
    } satisfies PersistReviewInput;
  });

const runReviewTest = <A, E>(
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

describe('PracticeReviewStore PostgreSQL transaction', () => {
  it('returns the revision written by PostgreSQL', async () => {
    await runReviewTest(
      Effect.gen(function* () {
        const store = yield* PracticeReviewStore;
        const sql = yield* Database;
        const input = yield* makeInput(dueEntryId, 'to_target', 'souvenir');
        expect(yield* store.commit(input)).toBe(1);
        const rows = yield* sql<{
          readonly revision: number;
          readonly reviews: number;
        }>`
          select c.revision, count(r.id)::integer as reviews
          from cards c
          left join reviews r on r.card_id = c.id
          where c.id = ${input.card.id}
          group by c.id
        `;
        expect(rows.at(0)).toEqual({ revision: 1, reviews: 1 });
      }),
    );
  });

  it('accepts exactly one concurrent submission for a revision', async () => {
    await runReviewTest(
      Effect.gen(function* () {
        const store = yield* PracticeReviewStore;
        const sql = yield* Database;
        const input = yield* makeInput(freshEntryId, 'to_target', 'ouvrage');
        const results = yield* Effect.all(
          [
            store.commit(input).pipe(Effect.either),
            store.commit(input).pipe(Effect.either),
          ],
          { concurrency: 'unbounded' },
        );
        const accepted = results.filter((result) => result._tag === 'Right');
        const rejected = results.filter((result) => result._tag === 'Left');
        expect(accepted).toHaveLength(1);
        expect(
          accepted.at(0)?._tag === 'Right' ? accepted[0].right : null,
        ).toBe(1);
        expect(rejected).toHaveLength(1);
        expect(
          rejected.at(0)?._tag === 'Left' ? rejected[0].left : null,
        ).toBeInstanceOf(StaleAnswerSubmissionError);
        const rows = yield* sql<{
          readonly revision: number;
          readonly reviews: number;
        }>`
          select c.revision, count(r.id)::integer as reviews
          from cards c
          left join reviews r on r.card_id = c.id
          where c.id = ${input.card.id}
          group by c.id
        `;
        expect(rows.at(0)).toEqual({ revision: 1, reviews: 1 });
      }),
    );
  });

  it('rolls back the card and accepted alternative when review insertion fails', async () => {
    await runReviewTest(
      Effect.gen(function* () {
        const store = yield* PracticeReviewStore;
        const sql = yield* Database;
        yield* sql`
          alter table reviews add constraint test_reject_review
          check (answer_text <> 'force rollback')
        `;
        const input = yield* makeInput(
          freshEntryId,
          'to_native',
          'force rollback',
        );
        expect((yield* store.commit(input).pipe(Effect.either))._tag).toBe(
          'Left',
        );
        const cards = yield* sql<{ readonly revision: number }>`
          select revision from cards where id = ${input.card.id}
        `;
        const reviews = yield* sql<{ readonly count: number }>`
          select count(*)::integer as count from reviews
          where card_id = ${input.card.id}
        `;
        const alternatives = yield* sql<{ readonly count: number }>`
          select count(*)::integer as count from accepted_answers
          where entry_id = ${input.entryId}
            and direction = ${input.direction}
            and normalized = ${input.normalizedAnswer}
        `;
        expect(cards.at(0)?.revision).toBe(0);
        expect(reviews.at(0)?.count).toBe(0);
        expect(alternatives.at(0)?.count).toBe(0);
      }),
    );
  });
});
