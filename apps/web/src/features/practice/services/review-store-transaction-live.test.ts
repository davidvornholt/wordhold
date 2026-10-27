import { describe, expect, it } from 'bun:test';
import type { JudgeVerdictData } from '@wordhold/ai/judge/schema';
import { Database } from '@wordhold/db/client';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect, Layer } from 'effect';
import {
  dueEntryId,
  firstReviewEntryId,
  fixtureCourseId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { writeRelatedWords } from '../../../shared/vocabulary/related-words-store';
import { StaleAnswerSubmissionError } from '../errors/practice-errors';
import type { PersistReviewInput } from '../schemas/practice-models';
import { PracticeReviewStore } from './review-store';

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

const makeInput = (
  entryId: string,
  direction: AnswerDirection,
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
      mode: 'scheduled',
      entryId,
      direction,
      normalizedAnswer: answer,
      gradedTexts: {
        targetText: submission.entry.targetText,
        nativeText: submission.entry.nativeText,
      },
    } satisfies PersistReviewInput;
  });

const runReviewTest = <A, E>(
  test: Effect.Effect<A, E, Database | PracticeReviewStore>,
) =>
  Effect.runPromise(
    withMigratedTestDatabase((database) => {
      const databaseLayer = testDatabaseLayer(database.url);
      return Effect.andThen(seedIntroducedCardFixture, test).pipe(
        Effect.provide(
          PracticeReviewStore.live.pipe(Layer.provide(databaseLayer)),
        ),
        Effect.provide(databaseLayer),
      );
    }),
  );

const correctEntry = (sql: Database) =>
  sql`
    update entries set target_text = 'lièvre', native_text = 'Hase'
    where id = ${firstReviewEntryId}
  `.pipe(
    Effect.andThen(
      sql`
        delete from accepted_answers
        where entry_id = ${firstReviewEntryId} and source = 'judge'
      `,
    ),
  );

const judgeAlternatives = (sql: Database) =>
  sql<{ readonly text: string }>`
    select text from accepted_answers
    where entry_id = ${firstReviewEntryId} and source = 'judge'
  `;

describe('PracticeReviewStore PostgreSQL transaction', () => {
  it('returns the revision written by PostgreSQL', async () => {
    await runReviewTest(
      Effect.gen(function* () {
        const store = yield* PracticeReviewStore;
        const sql = yield* Database;
        const input = yield* makeInput(dueEntryId, 'to_target', 'souvenir');
        expect(yield* store.commit(input)).toMatchObject({ revision: 1 });
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
        const input = yield* makeInput(
          firstReviewEntryId,
          'to_target',
          'ouvrage',
        );
        const results = yield* Effect.all(
          [
            store.commit(input).pipe(Effect.result),
            store.commit(input).pipe(Effect.result),
          ],
          { concurrency: 'unbounded' },
        );
        const accepted = results.filter((result) => result._tag === 'Success');
        const rejected = results.filter((result) => result._tag === 'Failure');
        expect(accepted).toHaveLength(1);
        expect(
          accepted.at(0)?._tag === 'Success' ? accepted[0].success : null,
        ).toMatchObject({ revision: 1 });
        expect(rejected).toHaveLength(1);
        expect(
          rejected.at(0)?._tag === 'Failure' ? rejected[0].failure : null,
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
          firstReviewEntryId,
          'to_native',
          'force rollback',
        );
        expect((yield* store.commit(input).pipe(Effect.result))._tag).toBe(
          'Failure',
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

describe('PracticeReviewStore judge alternatives', () => {
  it('keeps no judge alternative for an entry edited after grading began', async () => {
    await runReviewTest(
      Effect.gen(function* () {
        const store = yield* PracticeReviewStore;
        const sql = yield* Database;
        const input = yield* makeInput(
          firstReviewEntryId,
          'to_native',
          'das Buch',
        );
        yield* correctEntry(sql);

        const committed = yield* store.commit(input);
        expect(yield* judgeAlternatives(sql)).toEqual([]);
        expect(committed).toMatchObject({
          revision: 1,
          alternativeStored: false,
        });
      }),
    );
  });

  it('keeps a judge alternative while the entry is unchanged', async () => {
    await runReviewTest(
      Effect.gen(function* () {
        const store = yield* PracticeReviewStore;
        const sql = yield* Database;
        const input = yield* makeInput(
          firstReviewEntryId,
          'to_native',
          'das Buch',
        );

        const committed = yield* store.commit(input);
        expect(yield* judgeAlternatives(sql)).toEqual([{ text: 'das Buch' }]);
        expect(committed).toMatchObject({ alternativeStored: true });
      }),
    );
  });

  it('reports no judge alternative when a stored answer differs only in case', async () => {
    await runReviewTest(
      Effect.gen(function* () {
        const store = yield* PracticeReviewStore;
        const sql = yield* Database;
        yield* sql`
          insert into accepted_answers
            (entry_id, direction, text, normalized, source)
          values (${firstReviewEntryId}, 'to_native', 'Das Buch', 'das buch',
            'manual')
        `;
        const input = yield* makeInput(
          firstReviewEntryId,
          'to_native',
          'das Buch',
        );

        const committed = yield* store.commit({
          ...input,
          normalizedAnswer: 'das buch',
        });
        expect(yield* judgeAlternatives(sql)).toEqual([]);
        expect(committed).toMatchObject({ alternativeStored: false });
      }),
    );
  });
});

it('persists a review after an open text edit preserves its synonym card', async () => {
  await runReviewTest(
    Effect.gen(function* () {
      const store = yield* PracticeReviewStore;
      const sql = yield* Database;
      const relatedWords = [
        {
          courseId: fixtureCourseId,
          entryId: firstReviewEntryId,
          synonyms: ['bouquin'],
          antonyms: [],
        },
      ];
      yield* sql.withTransaction(writeRelatedWords(sql, relatedWords));
      const input = yield* makeInput(firstReviewEntryId, 'to_synonym', 'tome');
      const entryLocked = Promise.withResolvers<number>();
      const releaseEdit = Promise.withResolvers<void>();
      const [committed] = yield* Effect.all(
        [
          Effect.gen(function* () {
            yield* Effect.promise(() => entryLocked.promise);
            return yield* store.commit(input);
          }),
          sql.withTransaction(
            Effect.gen(function* () {
              yield* sql`
                select id from entries where id = ${firstReviewEntryId}
                for no key update
              `;
              const [backend] = yield* sql<{ readonly pid: number }>`
                select pg_backend_pid() as pid
              `;
              entryLocked.resolve(backend?.pid ?? 0);
              yield* Effect.promise(() => releaseEdit.promise);
              yield* correctEntry(sql);
              yield* writeRelatedWords(sql, relatedWords);
            }),
          ),
          Effect.gen(function* () {
            const pid = yield* Effect.promise(() => entryLocked.promise);
            let blocked = false;
            while (!blocked) {
              const [waiting] = yield* sql<{ readonly blocked: boolean }>`
                select exists (
                  select 1 from pg_stat_activity
                  where datname = current_database()
                    and ${pid} = any(pg_blocking_pids(pid))
                ) as blocked
              `;
              blocked = waiting?.blocked === true;
              if (!blocked) {
                yield* Effect.sleep('10 millis');
              }
            }
            releaseEdit.resolve();
          }),
        ],
        { concurrency: 'unbounded' },
      ).pipe(Effect.timeout('3 seconds'));

      expect(yield* judgeAlternatives(sql)).toEqual([]);
      expect(committed).toMatchObject({
        revision: 1,
        alternativeStored: false,
        schedule: { advanced: true },
      });
      const [card] = yield* sql<{
        readonly revision: number;
        readonly state: string;
        readonly dueAt: Date | null;
        readonly reps: number;
        readonly lastReviewedAt: Date | null;
      }>`
        select revision, state, due_at as "dueAt", reps,
          last_reviewed_at as "lastReviewedAt"
        from cards where id = ${input.card.id}
      `;
      expect(card).toEqual({
        revision: 1,
        state: committed.schedule.state,
        dueAt: committed.schedule.dueAt,
        reps: 1,
        lastReviewedAt: input.reviewedAt,
      });
      const reviews = yield* sql`
        select rating, answer_text as answer, grading from reviews
        where card_id = ${input.card.id}
      `;
      expect(reviews).toEqual([
        {
          rating: input.rating,
          answer: input.answer,
          grading: input.outcome,
        },
      ]);
    }),
  );
});
