import { Judge } from '@wordhold/ai/judge';
import { BedrockProvider } from '@wordhold/ai/providers/bedrock';
import { AiUsage } from '@wordhold/ai/usage';
import { Database, PgLive } from '@wordhold/db/client';
import { Effect, Layer } from 'effect';
import { PracticeJudge } from '../src/features/practice/services/practice-judge';
import {
  applyReviewRepairs,
  planReviewRepairs,
} from '../src/features/practice/services/review-repair';
import { UsageLedger } from '../src/shared/ai/usage-ledger';

const args = globalThis.Bun.argv.slice(2);
const apply = args.includes('--apply');
const ids = args.filter((arg) => arg !== '--apply');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
// A repair is maintenance, so its grading is billed to the administrator.
const administratorUsage = Layer.effect(
  AiUsage,
  Effect.gen(function* () {
    const sql = yield* Database;
    const ledger = yield* UsageLedger;
    const [administrator] = yield* sql<{ readonly userId: string }>`
      select user_id as "userId" from members where admin
    `;
    if (administrator === undefined) {
      return yield* Effect.fail(
        new Error('Sign in as the administrator once before repairing.'),
      );
    }
    return ledger.forPerson(administrator.userId);
  }),
).pipe(Layer.provide(UsageLedger.live(PgLive)));

const services = PracticeJudge.live.pipe(
  Layer.provide(Judge.layer.pipe(Layer.provide(BedrockProvider.live))),
  Layer.merge(administratorUsage),
  Layer.provideMerge(PgLive),
);

const program = Effect.gen(function* () {
  const plans = yield* planReviewRepairs(ids);
  if (apply) {
    yield* applyReviewRepairs(plans);
  }
  return {
    applied: apply,
    cards: plans.map((plan) => ({
      cardId: plan.card.id,
      vocabulary: plan.card.targetText,
      previousState: plan.card.state,
      state: plan.next.state,
      dueAt: plan.next.dueAt,
      difficulty: plan.next.difficulty,
      corrections: plan.corrections.map((item) => ({
        reviewId: item.review.id,
        reviewedAt: item.review.reviewedAt,
        previousRating: item.review.rating,
        rating: item.rating,
      })),
    })),
  };
}).pipe(Effect.provide(services));

if (ids.length === 0 || ids.some((id) => !uuid.test(id))) {
  await globalThis.Bun.write(
    globalThis.Bun.stderr,
    'Usage: bun run practice:repair [--apply] <card UUID> ...\nDefault: read-only reassessment. Provider calls may incur costs.\n',
  );
  // biome-ignore lint/correctness/noProcessGlobal: CLI usage failure must reach the shell.
  globalThis.process.exitCode = 1;
} else {
  const result = await Effect.runPromise(program.pipe(Effect.result));
  if (result._tag === 'Failure') {
    await globalThis.Bun.write(
      globalThis.Bun.stderr,
      `${result.failure.message}\n`,
    );
    // biome-ignore lint/correctness/noProcessGlobal: CLI failure must reach the shell.
    globalThis.process.exitCode = 1;
  } else {
    await globalThis.Bun.write(
      globalThis.Bun.stdout,
      `${JSON.stringify(result.success, null, 2)}\n`,
    );
  }
}
