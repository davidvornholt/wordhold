import { Effect } from 'effect';
import { serverEnv } from '../env/server';
import { AuthorizationError } from './authorization-error';
import { OwnerRepository } from './owner-repository';

const deniedMessage = 'This Wordhold instance belongs to someone else.';

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

export const assertAllowedUser = (userId: string) =>
  Effect.gen(function* () {
    const repository = yield* OwnerRepository;
    if (!(yield* repository.isAllowedUser(userId))) {
      return yield* new AuthorizationError({ message: deniedMessage });
    }
  });
