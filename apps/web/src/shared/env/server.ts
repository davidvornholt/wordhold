// The designated server environment boundary: the only application file
// allowed to read process.env (scoped override in the root biome.jsonc).
// Values are read lazily so importing this module never fails in bundles
// that do not use them.
import process from 'node:process';

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
};

export const serverEnv = {
  databaseUrl: () => required('DATABASE_URL'),
  authSecret: () => required('AUTH_SECRET'),
  githubClientId: () => required('GITHUB_CLIENT_ID'),
  githubClientSecret: () => required('GITHUB_CLIENT_SECRET'),
  githubAllowedUserId: () => required('GITHUB_ALLOWED_USER_ID'),
} as const;
