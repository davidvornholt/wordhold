import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';
import { requestMember } from '../../../shared/auth/member-request';
import {
  decodeCreateTextEntry,
  decodeUpdateTextEntry,
} from '../schemas/text-entry-changes';
import { textRuntime } from './course-runtimes';
import { TextEntryService } from './text-entry-service';

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
