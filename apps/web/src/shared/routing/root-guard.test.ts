import { describe, expect, it } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import { redirectUnauthorizedRoute } from './root-guard';

const captureFailure = async (
  effect: () => Promise<void>,
): Promise<unknown> => {
  try {
    await effect();
    return null;
  } catch (cause) {
    return cause;
  }
};

const member = { name: 'Anna', admin: false } as const;
const administrator = { name: 'David', admin: true } as const;

describe('redirectUnauthorizedRoute', () => {
  it('redirects an expired session before an owner loader runs', async () => {
    const failure = await captureFailure(() =>
      redirectUnauthorizedRoute('/courses/course-1/practice', () =>
        Promise.resolve(null),
      ),
    );
    expect(isRedirect(failure)).toBe(true);
    expect((failure as { options: { to: string } }).options.to).toBe('/');
  });

  it('protects persisted import session routes', async () => {
    await expect(
      redirectUnauthorizedRoute('/imports/session-1', () =>
        Promise.resolve(null),
      ),
    ).rejects.toBeDefined();
  });

  it('protects the passkey page', async () => {
    await expect(
      redirectUnauthorizedRoute('/passkeys', () => Promise.resolve(null)),
    ).rejects.toBeDefined();
    await redirectUnauthorizedRoute('/passkeys', () => Promise.resolve(member));
  });

  it('keeps people who are not the administrator out of account management', async () => {
    const failures = await Promise.all(
      ['/people', '/people/user-1'].map((pathname) =>
        captureFailure(() =>
          redirectUnauthorizedRoute(pathname, () => Promise.resolve(member)),
        ),
      ),
    );
    expect(failures.every(isRedirect)).toBe(true);
    const allowed = await Promise.all(
      ['/people', '/people/user-1'].map((pathname) =>
        captureFailure(() =>
          redirectUnauthorizedRoute(pathname, () =>
            Promise.resolve(administrator),
          ),
        ),
      ),
    );
    expect(allowed).toEqual([null, null]);
  });

  it('leaves the signed-out home and join routes available', async () => {
    let checkedSession = false;
    const checkSession = () => {
      checkedSession = true;
      return Promise.resolve(null);
    };
    await Promise.all(
      ['/', '/join', '/peoples'].map((pathname) =>
        redirectUnauthorizedRoute(pathname, checkSession),
      ),
    );
    expect(checkedSession).toBe(false);
  });
});
