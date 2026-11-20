import { expect, it } from 'bun:test';
import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import { Database } from '@wordhold/db/client';
import { applyRating } from '@wordhold/db/fsrs';
import {
  testDatabaseLayer,
  testTimeZone,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import {
  firstReviewEntryId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { expireEntryCards } from '../../courses/services/entry-answers';
import { PracticeJudge } from './practice-judge';
import { applyReviewRepairs, planReviewRepairs } from './review-repair';
import type { RepairCard } from './review-repair-plan';

// A card whose only answer was graded 2 by the judge, although its notation
// matches the textbook answer exactly, so repair plans to regrade it.
const seedMisgradedCard = Effect.gen(function* () {
  const sql = yield* Database;
  yield* seedIntroducedCardFixture;
  const [card] = yield* sql<{
    readonly id: string;
  }>`select id from cards where entry_id = ${firstReviewEntryId} and direction = 'to_target'`;
  if (card === undefined) {
    return yield* Effect.die('Fixture card missing');
  }
  yield* sql`update entries set target_text = 'el/la abogado/-a', native_text = 'Rechtsanwalt' where id = ${firstReviewEntryId}`;
  yield* sql`insert into accepted_answers (entry_id, direction, text, normalized, source)
values (${firstReviewEntryId}, 'to_target', 'el/la abogado/-a', 'el/la abogado/-a', 'textbook')`;
  const reviewedAt = new Date('2026-09-21T10:00:00Z');
  const empty: RepairCard = {
    id: card.id,
    entryId: firstReviewEntryId,
    direction: 'to_target',
    state: 'new',
    introducedAt: reviewedAt,
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
  const original = applyRating(empty, 2, reviewedAt, testTimeZone);
  yield* sql`update cards set state = ${original.state}::card_state, due_at = ${original.dueAt},
stability = ${original.stability}, stability_fast = ${original.stabilityFast},
difficulty = ${original.difficulty}, reps = ${original.reps},
lapses = ${original.lapses}, scheduled_days = ${original.scheduledDays},
learning_steps = ${original.learningSteps},
last_reviewed_at = ${original.lastReviewedAt}, revision = 1 where id = ${card.id}`;
  yield* sql`insert into reviews (card_id, reviewed_at, rating, answer_text, grading, elapsed_ms)
values (${card.id}, ${reviewedAt}, 2, 'el abogado / la abogada', '{"method":"judge","original":true}'::jsonb, 3000)`;
  return card;
});

it('plans without writes, refuses concurrent changes, and preserves original grades on atomic repair', async () => {
  await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        const sql = yield* Database;
        const card = yield* seedMisgradedCard;
        const plans = yield* planReviewRepairs([card.id], testTimeZone);
        expect(plans).toHaveLength(1);
        const [before] = yield* sql<{
          readonly rating: number;
        }>`select rating from reviews where card_id = ${card.id}`;
        expect(before?.rating).toBe(2);
        yield* sql`update cards set revision = revision + 1 where id = ${card.id}`;
        const stale = yield* applyReviewRepairs(plans).pipe(Effect.result);
        expect(stale._tag).toBe('Failure');
        const [unchanged] = yield* sql<{
          readonly rating: number;
        }>`select rating from reviews where card_id = ${card.id}`;
        expect(unchanged?.rating).toBe(2);

        const refreshed = yield* planReviewRepairs([card.id], testTimeZone);
        yield* applyReviewRepairs(refreshed);
        const [repaired] = yield* sql<{
          readonly rating: number;
          readonly grading: unknown;
        }>`select rating, grading from reviews where card_id = ${card.id}`;
        // The repaired answer was the card's first, so speed does not make it easy.
        expect(repaired?.rating).toBe(ratings.good);
        expect(repaired?.grading).toMatchObject({
          method: 'exact',
          repair: {
            originalRating: 2,
            originalGrading: { method: 'judge', original: true },
          },
        });
        expect(yield* planReviewRepairs([card.id], testTimeZone)).toHaveLength(
          0,
        );
      }).pipe(
        Effect.provide(testDatabaseLayer(database.url)),
        Effect.provideService(PracticeJudge, {
          model: 'test',
          judge: () =>
            Effect.die('Deterministic notation should not call a model'),
        }),
        Effect.provide(untrackedAiUsage),
      ),
    ),
  );
});

it('refuses to reassess a card from a terms course', async () => {
  await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        const sql = yield* Database;
        yield* seedIntroducedCardFixture;
        yield* sql`update courses set kind = 'terms', target_language = 'de', directions = '{to_native}'
      where id = (select course_id from entries where id = ${firstReviewEntryId})`;
        const [card] = yield* sql<{
          readonly id: string;
        }>`select id from cards where entry_id = ${firstReviewEntryId} and direction = 'to_native'`;
        if (card === undefined) {
          return yield* Effect.die('Fixture card missing');
        }
        const plan = yield* planReviewRepairs([card.id], testTimeZone).pipe(
          Effect.result,
        );
        expect(plan).toMatchObject({
          _tag: 'Failure',
          failure: { _tag: 'ReviewRepairError' },
        });
      }).pipe(
        Effect.provide(testDatabaseLayer(database.url)),
        Effect.provideService(PracticeJudge, {
          model: 'test',
          judge: () =>
            Effect.die('A term must not reach the translation judge'),
        }),
        Effect.provide(untrackedAiUsage),
      ),
    ),
  );
});

it('lets a correction of the entry expire a card that repair is about to regrade', async () => {
  await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
        const sql = yield* Database;
        const card = yield* seedMisgradedCard;
        const plans = yield* planReviewRepairs([card.id], testTimeZone);
        const entryLocked = Promise.withResolvers<number>();
        const releaseEdit = Promise.withResolvers<void>();
        const [, repair] = yield* Effect.all(
          [
            // A correction of the entry's texts, held after it updated the
            // entry row and before it expires the entry's cards.
            sql.withTransaction(
              Effect.gen(function* () {
                const [backend] = yield* sql<{ readonly pid: number }>`
                  select pg_backend_pid() as pid
                `;
                yield* sql`update entries set native_text = 'Anwalt' where id = ${firstReviewEntryId}`;
                entryLocked.resolve(backend?.pid ?? 0);
                yield* Effect.promise(() => releaseEdit.promise);
                yield* expireEntryCards(sql, firstReviewEntryId);
              }),
            ),
            Effect.promise(() => entryLocked.promise).pipe(
              Effect.andThen(applyReviewRepairs(plans)),
              Effect.result,
            ),
            Effect.gen(function* () {
              const pid = yield* Effect.promise(() => entryLocked.promise);
              let repairWaits = false;
              while (!repairWaits) {
                const [waiting] = yield* sql<{ readonly blocked: boolean }>`
                  select exists (
                    select 1 from pg_stat_activity
                    where datname = current_database()
                      and ${pid} = any(pg_blocking_pids(pid))
                  ) as blocked
                `;
                repairWaits = waiting?.blocked === true;
                if (!repairWaits) {
                  yield* Effect.sleep('10 millis');
                }
              }
              releaseEdit.resolve();
            }),
          ],
          { concurrency: 'unbounded' },
        ).pipe(Effect.timeout('5 seconds'));
        // Repair waits for the correction instead of deadlocking with it, then
        // finds the card expired and leaves it for a new plan.
        expect(repair).toMatchObject({
          _tag: 'Failure',
          failure: {
            message:
              'Karte oder Verlauf inzwischen geändert. Plan erneut erstellen.',
          },
        });
      }).pipe(
        Effect.provide(testDatabaseLayer(database.url)),
        Effect.provideService(PracticeJudge, {
          model: 'test',
          judge: () =>
            Effect.die('Deterministic notation should not call a model'),
        }),
        Effect.provide(untrackedAiUsage),
      ),
    ),
  );
});
