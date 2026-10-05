import { aiPrice, estimateUsd } from '@wordhold/ai/cost';
import { type AiCall, type AiCallUsage, AiUsage } from '@wordhold/ai/usage';
import { AiUsageError } from '@wordhold/ai/usage-error';
import { Database } from '@wordhold/db/client';
import { Cause, Context, Effect, Layer } from 'effect';

// USD estimates keep eight decimal places, as the column does.
const usdDecimals = 8;

const settledColumns = (call: AiCall, usage: AiCallUsage | undefined) => {
  const price = aiPrice(call);
  const estimate =
    usage === undefined || price === undefined
      ? undefined
      : estimateUsd(usage, price);
  return {
    inputTokens: usage?.tokens?.input ?? null,
    outputTokens: usage?.tokens?.output ?? null,
    cachedInputTokens: usage?.tokens?.cachedInput ?? null,
    characters: usage?.characters ?? null,
    audioSeconds: usage?.audioSeconds ?? null,
    usage: usage === undefined ? null : JSON.stringify(usage.raw ?? null),
    priceSnapshot: price === undefined ? null : JSON.stringify(price),
    estimatedUsd: estimate === undefined ? null : estimate.toFixed(usdDecimals),
  };
};

// Records every paid AI request against the person it was made for. A
// request for someone who is suspended or deleted is refused before it is
// sent.
export class UsageLedger extends Context.Service<
  UsageLedger,
  { readonly forPerson: (userId: string) => AiUsage['Service'] }
>()('@wordhold/web/ai/UsageLedger') {
  // A fresh pool cannot be exhausted by callers holding transaction locks.
  static readonly live = <E, R>(databaseLayer: Layer.Layer<Database, E, R>) =>
    Layer.effect(
      UsageLedger,
      Effect.gen(function* () {
        const sql = yield* Database;
        // Statements use the ledger's own pool. Effect keys open transactions by
        // client, so a caller's transaction on the application pool never
        // reaches these statements. Each autocommits and releases its
        // connection, so the pool can replace disconnected clients without
        // waiting on application transactions.
        const forPerson = (userId: string) =>
          AiUsage.of({
            start: (call) =>
              sql<{
                id: string;
              }>`insert into ai_usage (user_id, operation, provider, model)
              select ${userId}, ${call.operation}, ${call.provider}, ${call.model}
              where exists (select 1 from members where user_id = ${userId} and enabled)
              returning id`.pipe(
                Effect.mapError(
                  (cause) =>
                    new AiUsageError({
                      cause,
                      message: 'Die KI-Nutzung konnte nicht erfasst werden.',
                    }),
                ),
                Effect.flatMap(([row]) =>
                  row === undefined
                    ? Effect.fail(
                        new AiUsageError({
                          message: 'Dieses Konto hat keinen Zugang mehr.',
                        }),
                      )
                    : Effect.succeed({
                        settle: ({ succeeded, usage }) => {
                          const columns = settledColumns(call, usage);
                          return sql`update ai_usage set
                            status = ${succeeded ? 'succeeded' : 'failed'},
                            input_tokens = ${columns.inputTokens},
                            output_tokens = ${columns.outputTokens},
                            cached_input_tokens = ${columns.cachedInputTokens},
                            characters = ${columns.characters},
                            audio_seconds = ${columns.audioSeconds},
                            usage = ${columns.usage}::jsonb,
                            price_snapshot = ${columns.priceSnapshot}::jsonb,
                            estimated_usd = ${columns.estimatedUsd}::numeric
                          where id = ${row.id}`.pipe(
                            Effect.asVoid,
                            Effect.catchCause((cause) =>
                              Effect.logError(
                                'AI usage could not be settled',
                                Cause.pretty(cause),
                              ),
                            ),
                          );
                        },
                      }),
                ),
              ),
          });
        return UsageLedger.of({ forPerson });
      }),
    ).pipe(Layer.provide(Layer.fresh(databaseLayer)));
}

// Bills every AI request inside `effect` to one person.
export const billedTo =
  (userId: string) =>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E, Exclude<R, AiUsage> | UsageLedger> =>
    Effect.flatMap(UsageLedger, (ledger) =>
      Effect.provideService(effect, AiUsage, ledger.forPerson(userId)),
    );
