import { createServerFn } from '@tanstack/react-start';
import { BedrockProvider } from '@wordhold/ai/providers/bedrock';
import { WordRelations } from '@wordhold/ai/relations';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { billedTo, UsageLedger } from '../../../shared/ai/usage-ledger';
import { requestMember } from '../../../shared/auth/member-request';
import {
  decodeSaveWordRelations,
  decodeWordRelationRequest,
} from '../schemas/word-relations';
import { WordRelationService } from './word-relation-service';
import { WordRelationStore } from './word-relation-store';

const relationRuntime = ManagedRuntime.make(
  WordRelationService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        WordRelationStore.live.pipe(Layer.provide(PgLive)),
        WordRelations.layer.pipe(Layer.provide(BedrockProvider.live)),
      ),
    ),
    Layer.provideMerge(UsageLedger.live(PgLive)),
  ),
);

export const suggestWordRelations = createServerFn({ method: 'POST' })
  .validator(decodeWordRelationRequest)
  .handler(async ({ data }) => {
    const member = await requestMember({
      courses: [data.courseId],
      entries: data.entryIds,
    });
    return relationRuntime.runPromise(
      Effect.flatMap(WordRelationService, (service) =>
        service.suggest(data),
      ).pipe(billedTo(member.userId)),
    );
  });

export const saveWordRelations = createServerFn({ method: 'POST' })
  .validator(decodeSaveWordRelations)
  .handler(async ({ data }) => {
    await requestMember({
      courses: [data.courseId],
      entries: data.words.map((word) => word.entryId),
    });
    return relationRuntime.runPromise(
      Effect.flatMap(WordRelationService, (service) => service.save(data)),
    );
  });
