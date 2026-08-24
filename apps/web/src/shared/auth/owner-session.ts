import { Effect } from 'effect';
import { OwnerRepository } from './owner-repository';

type OwnerSessionIdentity = {
  readonly session: {
    readonly token: string;
  };
  readonly user: {
    readonly id: string;
  };
};

export const revalidateOwnerSession = <T extends OwnerSessionIdentity>(
  session: T | null,
) =>
  Effect.gen(function* () {
    if (session === null) {
      return null;
    }
    const repository = yield* OwnerRepository;
    if (yield* repository.isAllowedUser(session.user.id)) {
      return session;
    }
    yield* repository.revokeSession(session.session.token);
    return null;
  });
