import { createServerFn } from '@tanstack/react-start';
import { SpellingPitfalls } from '@wordhold/ai/pitfalls';
import { maximumPitfallBatch } from '@wordhold/ai/pitfalls/schema';
import { BedrockProvider } from '@wordhold/ai/providers/bedrock';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime, Schema } from 'effect';
import { billedTo, UsageLedger } from '../../../shared/ai/usage-ledger';
import { requestOwnedEntries } from '../../../shared/auth/member-request';
import { Uuid } from '../../../shared/validate/uuid';
import { SpellingPitfallService } from './spelling-pitfall-service';
import { SpellingPitfallStore } from './spelling-pitfall-store';

const pitfallRuntime = ManagedRuntime.make(
  SpellingPitfallService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        SpellingPitfallStore.live.pipe(Layer.provide(PgLive)),
        SpellingPitfalls.layer.pipe(Layer.provide(BedrockProvider.live)),
      ),
    ),
    Layer.provideMerge(UsageLedger.live(PgLive)),
  ),
);

const decodePitfallRequest = Schema.decodeUnknownSync(
  Schema.Array(Uuid).check(Schema.isMaxLength(maximumPitfallBatch)),
);

// Words of another member are left out like words that are gone.
export const prepareSpellingPitfalls = createServerFn({ method: 'POST' })
  .validator(decodePitfallRequest)
  .handler(async ({ data: entryIds }) => {
    const { member, owned } = await requestOwnedEntries(entryIds);
    return pitfallRuntime.runPromise(
      Effect.flatMap(SpellingPitfallService, (service) =>
        service.prepare(owned),
      ).pipe(billedTo(member.userId)),
    );
  });
