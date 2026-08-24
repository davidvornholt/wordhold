import { afterEach, describe, expect, it, mock } from 'bun:test';
import { github } from 'better-auth/social-providers';
import { makeAllowedGithubProfileMapper } from './owner';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('GitHub OAuth owner boundary', () => {
  it('stops a denied provider profile before the persistence step', async () => {
    const mapAllowedGithubProfile = makeAllowedGithubProfileMapper(() => '123');
    const persistUserAndAccount = mock(() => undefined);
    globalThis.fetch = Object.assign(
      mock((input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url.endsWith('/user/emails')) {
          return Promise.resolve(
            Response.json([
              {
                email: 'other@example.com',
                primary: true,
                verified: true,
                visibility: 'private',
              },
            ]),
          );
        }
        return Promise.resolve(
          Response.json({
            id: 456,
            login: 'other-user',
            name: 'Other user',
            email: 'other@example.com',
          }),
        );
      }),
      { preconnect: originalFetch.preconnect },
    );
    const provider = github({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      mapProfileToUser: mapAllowedGithubProfile,
    });

    const completeOAuth = async () => {
      await provider.getUserInfo({ accessToken: 'github-token' });
      persistUserAndAccount();
    };

    await expect(completeOAuth()).rejects.toThrow(
      'This Wordhold instance belongs to someone else.',
    );
    expect(persistUserAndAccount).not.toHaveBeenCalled();
  });

  it('lets the configured owner continue to persistence', () => {
    const mapAllowedGithubProfile = makeAllowedGithubProfileMapper(() => '123');
    expect(mapAllowedGithubProfile({ id: 123 })).toEqual({});
  });
});
