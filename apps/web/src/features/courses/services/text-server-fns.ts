import { createServerFn } from '@tanstack/react-start';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { requestMember } from '../../../shared/auth/member-request';
import {
  decodeCreateTextEntry,
  decodeUpdateTextEntry,
} from '../schemas/text-entry-changes';
import { TextEntryService } from './text-entry-service';
import { TextEntryStore } from './text-entry-store';

const textRuntime = ManagedRuntime.make(
  TextEntryService.Default.pipe(
    Layer.provide(TextEntryStore.live.pipe(Layer.provide(PgLive))),
  ),
);

export const createTextEntry = createServerFn({ method: 'POST' })
  .validator(decodeCreateTextEntry)
  .handler(async ({ data }) => {
    await requestMember({ courses: [data.courseId] });
    return textRuntime.runPromise(
      Effect.flatMap(TextEntryService, (service) => service.create(data)),
    );
  });

export const updateTextEntry = createServerFn({ method: 'POST' })
  .validator(decodeUpdateTextEntry)
  .handler(async ({ data }) => {
    await requestMember({
      courses: [data.courseId],
      entries: [data.entryId],
    });
    return textRuntime.runPromise(
      Effect.flatMap(TextEntryService, (service) => service.update(data)),
    );
  });
