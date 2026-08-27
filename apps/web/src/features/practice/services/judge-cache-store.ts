import { JudgeVerdict } from '@wordhold/ai/judge/schema';
import { Database } from '@wordhold/db/client';
import { Context, Effect, Layer, Schema } from 'effect';
import { PracticeDatabaseError } from '../errors/practice-errors';
import type {
  CachedJudgeVerdict,
  JudgeCacheKey,
} from '../schemas/practice-models';

type CacheRow = {
  readonly verdict: unknown;
  readonly model: string;
};

const databaseError = (operation: string, cause: unknown) =>
  new PracticeDatabaseError({
    operation,
    cause,
    message:
      'Die zwischengespeicherte Bewertung konnte nicht verarbeitet werden.',
  });

export class JudgeCacheStore extends Context.Tag('wordhold/JudgeCacheStore')<
  JudgeCacheStore,
  {
    readonly read: (
      key: JudgeCacheKey,
      model: string,
    ) => Effect.Effect<CachedJudgeVerdict | undefined, PracticeDatabaseError>;
    readonly write: (
      key: JudgeCacheKey,
      value: CachedJudgeVerdict,
    ) => Effect.Effect<void, PracticeDatabaseError>;
    readonly withCriticalSection: <A, E, R>(
      key: JudgeCacheKey,
      effect: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E | PracticeDatabaseError, R>;
  }
>() {
  static readonly live = Layer.effect(
    JudgeCacheStore,
    Effect.gen(function* () {
      const sql = yield* Database;
      const read = (key: JudgeCacheKey, model: string) =>
        sql<CacheRow>`
          select verdict, model from judge_cache
          where entry_id = ${key.entryId} and direction = ${key.direction}
            and normalized_answer = ${key.normalizedAnswer}
            and model = ${model}
        `.pipe(
          Effect.flatMap((rows) => {
            const [row] = rows;
            if (row === undefined) {
              return Effect.succeed(undefined);
            }
            return Schema.decodeUnknown(JudgeVerdict)(row.verdict).pipe(
              Effect.map((verdict) => ({ verdict, model: row.model })),
              Effect.mapError((cause) =>
                databaseError('decode judge cache', cause),
              ),
            );
          }),
          Effect.mapError((cause) =>
            cause._tag === 'PracticeDatabaseError'
              ? cause
              : databaseError('read judge cache', cause),
          ),
        );
      const write = (key: JudgeCacheKey, value: CachedJudgeVerdict) =>
        sql`
          insert into judge_cache
            (entry_id, direction, normalized_answer, verdict, model)
          values (${key.entryId}, ${key.direction}, ${key.normalizedAnswer},
            ${JSON.stringify(value.verdict)}::jsonb, ${value.model})
          on conflict (entry_id, direction, normalized_answer) do update
          set verdict = excluded.verdict, model = excluded.model,
            created_at = now()
        `.pipe(
          Effect.asVoid,
          Effect.mapError((cause) => databaseError('write judge cache', cause)),
        );
      const withCriticalSection = <A, E, R>(
        key: JudgeCacheKey,
        effect: Effect.Effect<A, E, R>,
      ) => {
        const lockKey = JSON.stringify([
          key.entryId,
          key.direction,
          key.normalizedAnswer,
        ]);
        return sql
          .withTransaction(
            Effect.zipRight(
              sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
              effect,
            ),
          )
          .pipe(
            Effect.catchTag('SqlError', (cause) =>
              Effect.fail(databaseError('coordinate judge cache', cause)),
            ),
          );
      };
      return { read, write, withCriticalSection } as const;
    }),
  );
}
