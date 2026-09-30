import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { definitionLayer } from '../../../shared/ai/runtime';
import { requireSession } from '../../../shared/auth/require-session';
import { authRuntime } from '../../../shared/auth/runtime';
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
  TermEntryService.Default.pipe(
    Layer.provide(
      Layer.merge(
        TermEntryStore.live.pipe(Layer.provide(PgLive)),
        definitionLayer,
      ),
    ),
  ),
);

export const createTermEntry = createServerFn({ method: 'POST' })
  .validator(decodeCreateTermEntry)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return termRuntime.runPromise(
      Effect.flatMap(TermEntryService, (service) => service.create(data)),
    );
  });

export const updateTermEntry = createServerFn({ method: 'POST' })
  .validator(decodeUpdateTermEntry)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return termRuntime.runPromise(
      Effect.flatMap(TermEntryService, (service) => service.update(data)),
    );
  });

export const suggestTermDefinition = createServerFn({ method: 'POST' })
  .validator(decodeTermDefinitionSuggestion)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return termRuntime.runPromise(
      Effect.flatMap(TermEntryService, (service) =>
        service.suggestDefinition(data),
      ),
    );
  });

export const deriveTermKeyPoints = createServerFn({ method: 'POST' })
  .validator(decodeTermKeyPointsRequest)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return termRuntime.runPromise(
      Effect.flatMap(TermEntryService, (service) =>
        service.deriveKeyPoints(data),
      ),
    );
  });

export const updateTermKeyPoints = createServerFn({ method: 'POST' })
  .validator(decodeUpdateTermKeyPoints)
  .handler(async ({ data }) => {
    await authRuntime.runPromise(requireSession(getRequest().headers));
    return termRuntime.runPromise(
      Effect.flatMap(TermEntryService, (service) =>
        service.updateKeyPoints(data),
      ),
    );
  });
