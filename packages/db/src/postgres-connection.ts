import postgres from 'postgres';

export const postgresOptionsForUrl = (url: string) => {
  const { hostname } = new URL(url);
  if (!hostname.toLowerCase().startsWith('%2f')) {
    return {};
  }
  return { host: decodeURIComponent(hostname) } as const;
};

export const makePostgresConnection = (url: string) =>
  postgres(url, postgresOptionsForUrl(url));
