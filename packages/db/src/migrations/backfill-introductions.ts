import { and, isNotNull, isNull, sql } from 'drizzle-orm';
import { Config, Effect, Redacted } from 'effect';
import { makeDrizzle } from '../drizzle';
import { cards } from '../schema/practice';
import { IntroductionBackfillError } from './introduction-backfill-error';

const failure = (operation: string, cause: unknown) =>
  new IntroductionBackfillError({
    operation,
    cause,
    message: `Introduction backfill failed: ${operation}.`,
  });

const attempt = <A>(operation: string, action: () => Promise<A>) =>
  Effect.tryPromise({
    try: action,
    catch: (cause) => failure(operation, cause),
  });

export const backfillIntroductions = (url: string) =>
  Effect.acquireUseRelease(
    Effect.sync(() => makeDrizzle(url)),
    (database) =>
      Effect.gen(function* () {
        yield* attempt('stamp reviewed cards', () =>
          database
            .update(cards)
            .set({ introducedAt: sql`${cards.lastReviewedAt}` })
            .where(
              and(
                isNull(cards.introducedAt),
                isNotNull(cards.lastReviewedAt),
              ),
            ),
        );
        const remaining = yield* attempt('prove completion', () =>
          database
            .select({ id: cards.id })
            .from(cards)
            .where(
              and(
                isNull(cards.introducedAt),
                isNotNull(cards.lastReviewedAt),
              ),
            )
            .limit(1),
        );
        if (remaining.length > 0) {
          return yield* new IntroductionBackfillError({
            operation: 'prove completion',
            cause: remaining[0],
            message:
              'Introduction backfill left reviewed cards without a timestamp.',
          });
        }
      }),
    (database) => Effect.promise(() => database.$client.end()),
  );

if (import.meta.main) {
  const program = Effect.flatMap(Config.redacted('DATABASE_URL'), (url) =>
    backfillIntroductions(Redacted.value(url)),
  ).pipe(
    Effect.tap(() =>
      Effect.log(
        'Introduction backfill complete: reviewed cards without introduced_at = 0.',
      ),
    ),
  );
  await Effect.runPromise(program);
}
