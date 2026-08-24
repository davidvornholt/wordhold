import { describe, expect, it } from 'bun:test';
import { isRedirect } from '@tanstack/react-router';
import { redirectExpiredOwnerRoute } from './root-guard';

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

describe('redirectExpiredOwnerRoute', () => {
  it('redirects an expired session before an owner loader runs', async () => {
    const failure = await captureFailure(() =>
      redirectExpiredOwnerRoute('/courses/course-1/practice', () =>
        Promise.resolve(null),
      ),
    );
    expect(isRedirect(failure)).toBe(true);
    expect((failure as { options: { to: string } }).options.to).toBe('/');
  });

  it('leaves the signed-out home route available', async () => {
    let checkedSession = false;
    await redirectExpiredOwnerRoute('/', () => {
      checkedSession = true;
      return Promise.resolve(null);
    });
    expect(checkedSession).toBe(false);
  });
});
