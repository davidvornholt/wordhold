// The designated server environment boundary: the only application file
// allowed to read process.env (scoped override in the root biome.jsonc).
// Values are read lazily so importing this module never fails in bundles
// that do not use them.

import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
};

const optional = (name: string, fallback: string): string => {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
};

const requiredTimeZone = (name: string): string => {
  const value = required(name);
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
  } catch (cause) {
    throw new Error(`Invalid IANA time zone in ${name}: ${value}`, { cause });
  }
  return value;
};

const requiredHttpOrigin = (name: string): string => {
  const value = required(name);
  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new Error(`${name} must be an HTTP(S) origin`, { cause });
  }
  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
  const isOrigin =
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === '' &&
    url.username === '' &&
    url.password === '';
  if (!(isHttp && isOrigin)) {
    throw new Error(`${name} must be an HTTP(S) origin`);
  }
  return url.origin;
};

export const defaultDataDir = (): string =>
  join(homedir(), '.local', 'share', 'wordhold');

export const serverEnv = {
  databaseUrl: () => required('DATABASE_URL'),
  publicUrl: () => requiredHttpOrigin('WORDHOLD_PUBLIC_URL'),
  dataDir: () => optional('WORDHOLD_DATA_DIR', defaultDataDir()),
  ownerTimeZone: () => requiredTimeZone('WORDHOLD_OWNER_TIME_ZONE'),
  authSecret: () => required('AUTH_SECRET'),
  githubClientId: () => required('GITHUB_CLIENT_ID'),
  githubClientSecret: () => required('GITHUB_CLIENT_SECRET'),
  githubAllowedUserId: () => required('GITHUB_ALLOWED_USER_ID'),
} as const;
