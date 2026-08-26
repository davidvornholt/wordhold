import { eq, isNull, ne } from 'drizzle-orm';
import { Config, Effect, Redacted } from 'effect';
import { makeDrizzle } from '../drizzle';
import { entries } from '../schema/entries';
import { units } from '../schema/units';
import { fileLegacyVocabulary } from './file-legacy-vocabulary';
import { UnitBackfillError } from './unit-backfill-error';

const failure = (operation: string, cause: unknown) =>
  new UnitBackfillError({
    cause,
    operation,
    message: `Unit backfill failed: ${operation}.`,
  });

const attempt = <A>(operation: string, action: () => Promise<A>) =>
  Effect.tryPromise({
    try: action,
    catch: (cause) => failure(operation, cause),
  });

export const backfillUnits = (url: string) =>
  Effect.acquireUseRelease(
    Effect.sync(() => makeDrizzle(url)),
    (database) =>
      Effect.gen(function* () {
        const mismatches = yield* attempt('check course ownership', () =>
          database
            .select({ id: entries.id })
            .from(entries)
            .innerJoin(units, eq(entries.unitId, units.id))
            .where(ne(entries.courseId, units.courseId))
            .limit(1),
        );
        if (mismatches.length > 0) {
          return yield* new UnitBackfillError({
            cause: mismatches[0],
            operation: 'check course ownership',
            message:
              'Unit backfill stopped because an entry references a unit from another course.',
          });
        }

        yield* fileLegacyVocabulary(database);

        const remaining = yield* attempt('prove completion', () =>
          database
            .select({ id: entries.id })
            .from(entries)
            .where(isNull(entries.unitId))
            .limit(1),
        );
        if (remaining.length > 0) {
          return yield* new UnitBackfillError({
            cause: remaining[0],
            operation: 'prove completion',
            message: 'Unit backfill left vocabulary without a unit.',
          });
        }
      }),
    (database) => Effect.promise(() => database.$client.end()),
  );

if (import.meta.main) {
  const program = Effect.flatMap(Config.redacted('DATABASE_URL'), (url) =>
    backfillUnits(Redacted.value(url)),
  ).pipe(
    Effect.tap(() =>
      Effect.log('Unit backfill complete: entries with NULL unit_id = 0.'),
    ),
  );
  await Effect.runPromise(program);
}
