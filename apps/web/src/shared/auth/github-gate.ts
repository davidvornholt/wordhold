import { serverEnv } from '../env/server';
import { AuthorizationError } from './authorization-error';

const deniedMessage = 'This Wordhold instance belongs to someone else.';

// GitHub sign-in is reserved for the administrator. Throwing here stops
// Better Auth before it stores a user, an account or a session.
export const makeAllowedGithubProfileMapper =
  (getAllowedUserId: () => string) =>
  (profile: { readonly id: string | number }): Record<string, never> => {
    if (String(profile.id) !== getAllowedUserId()) {
      throw new AuthorizationError({ message: deniedMessage });
    }
    return {};
  };

export const mapAllowedGithubProfile = makeAllowedGithubProfileMapper(
  serverEnv.githubAllowedUserId,
);
