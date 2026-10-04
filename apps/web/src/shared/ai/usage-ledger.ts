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
    usage: usage === undefined ? null : JSON.stringify(usage.raw ?? null),
    priceSnapshot: price === undefined ? null : JSON.stringify(price),
    estimatedUsd: estimate === undefined ? null : estimate.toFixed(usdDecimals),
  };
};

// Records every paid AI request against the person it was made for. A
// request for someone who is suspended or deleted is refused before it is
// sent.
export class UsageLedger extends Context.Tag('@wordhold/web/ai/UsageLedger')<
  UsageLedger,
  { readonly forPerson: (userId: string) => AiUsage['Type'] }
>() {
  static readonly live = Layer.effect(
    UsageLedger,
    Effect.gen(function* () {
      const sql = yield* Database;
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
                            usage = ${columns.usage}::jsonb,
                            price_snapshot = ${columns.priceSnapshot}::jsonb,
                            estimated_usd = ${columns.estimatedUsd}::numeric
                          where id = ${row.id}`.pipe(
                          Effect.asVoid,
                          Effect.catchAllCause((cause) =>
                            Effect.logError(
                              'AI usage could not be settled',
                              Cause.pretty(cause, { renderErrorCause: true }),
                            ),
                          ),
                        );
                      },
                    }),
              ),
            ),
        });
      return { forPerson };
    }),
  );
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
