import { createServerFn } from '@tanstack/react-start';
import { Effect } from 'effect';
import { requestMember } from '../../../shared/auth/member-request';
import { bibleRuntime } from '../runtime';
import {
  decodeBibleRemoval,
  decodePassageLookup,
} from '../schemas/bible-requests';
import { BibleService } from './bible-service';

// The Bibles a person uploaded. Nobody else sees them.
export const listBibles = createServerFn().handler(async () => {
  const member = await requestMember();
  return bibleRuntime.runPromise(
    Effect.flatMap(BibleService, (service) => service.list(member.userId)),
  );
});

export const lookUpBiblePassage = createServerFn({ method: 'POST' })
  .validator(decodePassageLookup)
  .handler(async ({ data }) => {
    const member = await requestMember();
    return bibleRuntime.runPromise(
      Effect.flatMap(BibleService, (service) =>
        service.lookUp(member.userId, data.bibleId, data.reference),
      ),
    );
  });

export const removeBible = createServerFn({ method: 'POST' })
  .validator(decodeBibleRemoval)
  .handler(async ({ data }) => {
    const member = await requestMember();
    await bibleRuntime.runPromise(
      Effect.flatMap(BibleService, (service) =>
        service.remove(member.userId, data.bibleId),
      ),
    );
  });
