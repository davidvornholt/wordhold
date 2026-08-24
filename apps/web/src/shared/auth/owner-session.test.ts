import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';
import { AuthDatabaseError } from './auth-database-error';
import { OwnerRepository } from './owner-repository';
import { revalidateOwnerSession } from './owner-session';

const session = {
  session: { token: 'session-token' },
  user: { id: 'user-1', name: 'David' },
};

describe('owner session revalidation', () => {
  it('retains a database failure without revoking the session', async () => {
    const failure = new AuthDatabaseError({
      operation: 'check owner',
      cause: new Error('database unavailable'),
      message: 'database unavailable',
    });
    let revokeCalls = 0;
    const repository = OwnerRepository.of({
      isAllowedUser: () => Effect.fail(failure),
      revokeSession: () =>
        Effect.sync(() => {
          revokeCalls += 1;
        }),
    });
    const result = await Effect.runPromise(
      Effect.flip(
        revalidateOwnerSession(session).pipe(
          Effect.provideService(OwnerRepository, repository),
        ),
      ),
    );
    expect(result).toBe(failure);
    expect(revokeCalls).toBe(0);
  });

  it('rechecks the current owner and revokes a session after an allowlist change', async () => {
    let allowedUserId = 'user-1';
    const revokeSession = mock(() => Effect.void);
    const repository = OwnerRepository.of({
      isAllowedUser: (userId: string) =>
        Effect.succeed(userId === allowedUserId),
      revokeSession,
    });

    await expect(
      Effect.runPromise(
        revalidateOwnerSession(session).pipe(
          Effect.provideService(OwnerRepository, repository),
        ),
      ),
    ).resolves.toBe(session);

    allowedUserId = 'user-2';
    await expect(
      Effect.runPromise(
        revalidateOwnerSession(session).pipe(
          Effect.provideService(OwnerRepository, repository),
        ),
      ),
    ).resolves.toBe(null);
    expect(revokeSession).toHaveBeenCalledWith('session-token');
  });
});
