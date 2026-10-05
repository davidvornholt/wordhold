import { createServerFn } from '@tanstack/react-start';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { definitionLayer } from '../../../shared/ai/runtime';
import { billedTo, UsageLedger } from '../../../shared/ai/usage-ledger';
import { requestMember } from '../../../shared/auth/member-request';
import { decodeUpdateTermEntry } from '../schemas/entry-changes';
import {
  decodeCreateTermEntry,
  decodeTermDefinitionSuggestion,
  decodeTermKeyPointsRequest,
  decodeUpdateTermKeyPoints,
} from '../schemas/term-entry-creation';
import { TermEntryService } from './term-entry-service';
import { TermEntryStore } from './term-entry-store';

const termRuntime = ManagedRuntime.make(
  TermEntryService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        TermEntryStore.live.pipe(Layer.provide(PgLive)),
        definitionLayer,
      ),
    ),
    Layer.provideMerge(UsageLedger.live(PgLive)),
  ),
);

export const createTermEntry = createServerFn({ method: 'POST' })
  .validator(decodeCreateTermEntry)
  .handler(async ({ data }) => {
    await requestMember({ courses: [data.courseId] });
    return termRuntime.runPromise(
      Effect.flatMap(TermEntryService, (service) => service.create(data)),
    );
  });

export const updateTermEntry = createServerFn({ method: 'POST' })
  .validator(decodeUpdateTermEntry)
  .handler(async ({ data }) => {
    await requestMember({
      courses: [data.courseId],
      entries: [data.entryId],
    });
    return termRuntime.runPromise(
      Effect.flatMap(TermEntryService, (service) => service.update(data)),
    );
  });

export const suggestTermDefinition = createServerFn({ method: 'POST' })
  .validator(decodeTermDefinitionSuggestion)
  .handler(async ({ data }) => {
    const member = await requestMember({ courses: [data.courseId] });
    return termRuntime.runPromise(
      Effect.flatMap(TermEntryService, (service) =>
        service.suggestDefinition(data),
      ).pipe(billedTo(member.userId)),
    );
  });

export const deriveTermKeyPoints = createServerFn({ method: 'POST' })
  .validator(decodeTermKeyPointsRequest)
  .handler(async ({ data }) => {
    const member = await requestMember({
      courses: [data.courseId],
      entries: [data.entryId],
    });
    return termRuntime.runPromise(
      Effect.flatMap(TermEntryService, (service) =>
        service.deriveKeyPoints(data),
      ).pipe(billedTo(member.userId)),
    );
  });

export const updateTermKeyPoints = createServerFn({ method: 'POST' })
  .validator(decodeUpdateTermKeyPoints)
  .handler(async ({ data }) => {
    await requestMember({
      courses: [data.courseId],
      entries: [data.entryId],
    });
    return termRuntime.runPromise(
      Effect.flatMap(TermEntryService, (service) =>
        service.updateKeyPoints(data),
      ),
    );
  });
