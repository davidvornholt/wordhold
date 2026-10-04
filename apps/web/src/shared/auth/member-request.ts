import { getRequest } from '@tanstack/react-start/server';
import { Effect } from 'effect';
import type { Member } from './member-repository';
import { type OwnedReferences, ownedEntryIds } from './ownership';
import {
  requireAdministrator,
  requireMember,
  requireOwner,
} from './require-member';
import { authRuntime } from './runtime';

// The signed-in member making this server function call, after checking that
// every record the call names belongs to them.
export const requestMember = (owned: OwnedReferences = {}): Promise<Member> =>
  authRuntime.runPromise(requireOwner(getRequest().headers, owned));

export const requestOwnedEntries = (
  entryIds: ReadonlyArray<string>,
): Promise<{ readonly member: Member; readonly owned: Array<string> }> =>
  authRuntime.runPromise(
    requireMember(getRequest().headers).pipe(
      Effect.flatMap((member) =>
        Effect.map(ownedEntryIds(member.userId, entryIds), (owned) => ({
          member,
          owned,
        })),
      ),
    ),
  );

export const requestAdministrator = (): Promise<Member> =>
  authRuntime.runPromise(requireAdministrator(getRequest().headers));
