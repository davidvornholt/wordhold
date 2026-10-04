import { createServerFn } from '@tanstack/react-start';
import { PgLive } from '@wordhold/db/client';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { requestAdministrator } from '../../../shared/auth/member-request';
import { StorageLive } from '../../../shared/storage/server';
import {
  decodeAccessChange,
  decodeInvitation,
  decodeUsagePeriod,
  decodeUserId,
} from '../schemas/people-models';
import { deletePerson } from './delete-person';
import { PeopleStore, type PeopleStoreShape } from './people-store';

const peopleRuntime = ManagedRuntime.make(
  PeopleStore.live.pipe(Layer.provide(PgLive), Layer.merge(StorageLive)),
);

const withStore = <A, E>(
  work: (store: PeopleStoreShape) => Effect.Effect<A, E>,
) => peopleRuntime.runPromise(Effect.flatMap(PeopleStore, work));

export const listPeople = createServerFn().handler(async () => {
  await requestAdministrator();
  return withStore((store) => store.list);
});

export const getPerson = createServerFn()
  .validator(decodeUserId)
  .handler(async ({ data: userId }) => {
    await requestAdministrator();
    return withStore((store) => store.get(userId));
  });

export const invitePerson = createServerFn({ method: 'POST' })
  .validator(decodeInvitation)
  .handler(async ({ data }) => {
    await requestAdministrator();
    return withStore((store) => store.invite(data.name));
  });

export const issueAccessCode = createServerFn({ method: 'POST' })
  .validator(decodeUserId)
  .handler(async ({ data: userId }) => {
    await requestAdministrator();
    return withStore((store) => store.issueCode(userId));
  });

export const withdrawAccessCode = createServerFn({ method: 'POST' })
  .validator(decodeUserId)
  .handler(async ({ data: userId }) => {
    await requestAdministrator();
    return withStore((store) => store.withdrawCode(userId));
  });

export const setPersonAccess = createServerFn({ method: 'POST' })
  .validator(decodeAccessChange)
  .handler(async ({ data }) => {
    await requestAdministrator();
    return withStore((store) => store.setEnabled(data.userId, data.enabled));
  });

export const removePerson = createServerFn({ method: 'POST' })
  .validator(decodeUserId)
  .handler(async ({ data: userId }) => {
    await requestAdministrator();
    return peopleRuntime.runPromise(deletePerson(userId));
  });

export const getUsage = createServerFn()
  .validator(decodeUsagePeriod)
  .handler(async ({ data: days }) => {
    await requestAdministrator();
    return withStore((store) => store.usage(days));
  });
