import { expect, it } from 'bun:test';
import { Database } from '@wordhold/db/client';
import {
  testDatabaseLayer,
  withMigratedTestDatabase,
} from '@wordhold/db/testing/postgres-test-database';
import { Effect } from 'effect';
import { ratings } from '../../../shared/grading/rating';
import {
  firstReviewEntryId,
  seedIntroducedCardFixture,
} from '../../../shared/testing/introduced-card-fixture';
import { applyRating } from './fsrs';
import { PracticeJudge } from './practice-judge';
import { applyReviewRepairs, planReviewRepairs } from './review-repair';
import type { RepairCard } from './review-repair-plan';

it('plans without writes, refuses concurrent changes, and preserves original grades on atomic repair', async () => {
  await Effect.runPromise(
    withMigratedTestDatabase((database) =>
      Effect.gen(function* () {
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
          difficulty: null,
          reps: 0,
          lapses: 0,
          scheduledDays: 0,
          learningSteps: 0,
          lastReviewedAt: null,
          revision: 0,
        };
        const original = applyRating(empty, 2, reviewedAt);
        yield* sql`update cards set state = ${original.state}::card_state, due_at = ${original.dueAt},
      stability = ${original.stability}, difficulty = ${original.difficulty}, reps = ${original.reps},
      last_reviewed_at = ${original.lastReviewedAt}, revision = 1 where id = ${card.id}`;
        yield* sql`insert into reviews (card_id, reviewed_at, rating, answer_text, grading, elapsed_ms)
      values (${card.id}, ${reviewedAt}, 2, 'el abogado / la abogada', '{"method":"judge","original":true}'::jsonb, 3000)`;

        const plans = yield* planReviewRepairs([card.id]);
        expect(plans).toHaveLength(1);
        const [before] = yield* sql<{
          readonly rating: number;
        }>`select rating from reviews where card_id = ${card.id}`;
        expect(before?.rating).toBe(2);
        yield* sql`update cards set revision = revision + 1 where id = ${card.id}`;
        const stale = yield* applyReviewRepairs(plans).pipe(Effect.either);
        expect(stale._tag).toBe('Left');
        const [unchanged] = yield* sql<{
          readonly rating: number;
        }>`select rating from reviews where card_id = ${card.id}`;
        expect(unchanged?.rating).toBe(2);

        const refreshed = yield* planReviewRepairs([card.id]);
        yield* applyReviewRepairs(refreshed);
        const [repaired] = yield* sql<{
          readonly rating: number;
          readonly grading: unknown;
        }>`select rating, grading from reviews where card_id = ${card.id}`;
        expect(repaired?.rating).toBe(ratings.easy);
        expect(repaired?.grading).toMatchObject({
          method: 'exact',
          repair: {
            originalRating: 2,
            originalGrading: { method: 'judge', original: true },
          },
        });
        expect(yield* planReviewRepairs([card.id])).toHaveLength(0);
      }).pipe(
        Effect.provide(testDatabaseLayer(database.url)),
        Effect.provideService(PracticeJudge, {
          model: 'test',
          judge: () =>
            Effect.die('Deterministic notation should not call a model'),
        }),
      ),
    ),
  );
});
