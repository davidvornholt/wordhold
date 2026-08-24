import { describe, expect, it, mock } from 'bun:test';
import { revalidateOwnerSession } from './owner-session';

const session = {
  session: { token: 'session-token' },
  user: { id: 'user-1', name: 'David' },
};

describe('owner session revalidation', () => {
  it('rechecks the current owner and revokes a session after an allowlist change', async () => {
    let allowedUserId = 'user-1';
    const revokeSession = mock(async () => undefined);
    const dependencies = {
      isAllowedUser: async (userId: string) => userId === allowedUserId,
      revokeSession,
    };

    await expect(revalidateOwnerSession(session, dependencies)).resolves.toBe(
      session,
    );

    allowedUserId = 'user-2';
    await expect(revalidateOwnerSession(session, dependencies)).resolves.toBe(
      null,
    );
    expect(revokeSession).toHaveBeenCalledWith('session-token');
  });
});
