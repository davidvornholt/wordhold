import { serverEnv } from '../env/server';

const deniedMessage = 'This Wordhold instance belongs to someone else.';

export const makeAllowedGithubProfileMapper =
  (getAllowedUserId: () => string) =>
  (profile: { readonly id: string | number }): Record<string, never> => {
    if (String(profile.id) !== getAllowedUserId()) {
      throw new Error(deniedMessage);
    }
    return {};
  };

export const mapAllowedGithubProfile = makeAllowedGithubProfileMapper(
  serverEnv.githubAllowedUserId,
);

export const assertAllowedUser = async (
  userId: string,
  isAllowedUser: (candidateUserId: string) => Promise<boolean>,
): Promise<void> => {
  if (!(await isAllowedUser(userId))) {
    throw new Error(deniedMessage);
  }
};
