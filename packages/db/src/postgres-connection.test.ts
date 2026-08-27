import { describe, expect, it } from 'bun:test';
import { postgresOptionsForUrl } from './postgres-connection';

describe('postgresOptionsForUrl', () => {
  it('decodes a PostgreSQL socket from the encoded URL host', () => {
    expect(
      postgresOptionsForUrl(
        'postgresql://wordhold@%2Frun%2Fpostgresql/wordhold',
      ),
    ).toEqual({ host: '/run/postgresql' });
  });

  it('leaves TCP connection URLs to postgres-js', () => {
    expect(
      postgresOptionsForUrl(
        'postgresql://wordhold:secret@127.0.0.1:5432/wordhold',
      ),
    ).toEqual({});
  });
});
