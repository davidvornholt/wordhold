import { Duration, Effect } from 'effect';
import type { BenchmarkModel } from './runner';

// Reserved for each request until its usage is known. Prompts stay well
// below the allowance; output is bounded by the limit the request sends.
const inputTokenAllowance = 20_000;
const tokensPerMillion = 1_000_000;
const reservationPollMs = 250;

export const worstCaseUsd = (model: BenchmarkModel): number =>
  (inputTokenAllowance * model.usdPerMillionTokens.input +
    model.maxOutputTokens * model.usdPerMillionTokens.output) /
  tokensPerMillion;

// Estimated spend. Each request reserves its worst case before it starts, so
// concurrent requests cannot together exceed the limit, and settles to its
// reported cost when it ends.
export const makeBudget = (limitUsd: number) => {
  let spentUsd = 0;
  let reservedUsd = 0;
  // Waits while running requests hold the room this one needs. Succeeds with
  // false when it does not fit even once they have settled.
  const reserve = (amountUsd: number): Effect.Effect<boolean> =>
    Effect.suspend(() => {
      if (spentUsd + reservedUsd + amountUsd <= limitUsd) {
        reservedUsd += amountUsd;
        return Effect.succeed(true);
      }
      return reservedUsd > 0
        ? Effect.andThen(
            Effect.sleep(Duration.millis(reservationPollMs)),
            reserve(amountUsd),
          )
        : Effect.succeed(false);
    });
  const settle = (reservedUsdForRequest: number, actualUsd: number | null) => {
    reservedUsd -= reservedUsdForRequest;
    spentUsd += actualUsd ?? reservedUsdForRequest;
  };
  return { reserve, settle, spent: () => spentUsd };
};
