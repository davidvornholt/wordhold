import { afterEach, describe, expect, it } from 'bun:test';
import process from 'node:process';
import { defaultDataDir, serverEnv } from './server';

const originalAuthSecret = process.env.AUTH_SECRET;
const originalDataDir = process.env.WORDHOLD_DATA_DIR;
const originalOwnerTimeZone = process.env.WORDHOLD_OWNER_TIME_ZONE;
const originalPublicUrl = process.env.WORDHOLD_PUBLIC_URL;

const restore = (name: string, value: string | undefined): void => {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
};

afterEach(() => {
  restore('AUTH_SECRET', originalAuthSecret);
  restore('WORDHOLD_DATA_DIR', originalDataDir);
  restore('WORDHOLD_OWNER_TIME_ZONE', originalOwnerTimeZone);
  restore('WORDHOLD_PUBLIC_URL', originalPublicUrl);
});

describe('serverEnv', () => {
  it('returns the value when the variable is set', () => {
    process.env.AUTH_SECRET = 'test-secret';
    expect(serverEnv.authSecret()).toBe('test-secret');
  });

  it('throws when the variable is missing', () => {
    delete process.env.AUTH_SECRET;
    expect(() => serverEnv.authSecret()).toThrow(
      'Missing required environment variable AUTH_SECRET',
    );
  });

  it('treats an empty string as missing', () => {
    process.env.AUTH_SECRET = '';
    expect(() => serverEnv.authSecret()).toThrow(
      'Missing required environment variable AUTH_SECRET',
    );
  });

  it('stores app data outside the checkout by default', () => {
    delete process.env.WORDHOLD_DATA_DIR;
    expect(serverEnv.dataDir()).toBe(defaultDataDir());
    expect(serverEnv.dataDir()).not.toStartWith(`${process.cwd()}/`);
  });

  it('honors an explicit deployment data directory', () => {
    process.env.WORDHOLD_DATA_DIR = '/var/lib/wordhold';
    expect(serverEnv.dataDir()).toBe('/var/lib/wordhold');
  });

  it('accepts an IANA owner time zone', () => {
    process.env.WORDHOLD_OWNER_TIME_ZONE = 'Europe/Berlin';
    expect(serverEnv.ownerTimeZone()).toBe('Europe/Berlin');
  });

  it('rejects an invalid owner time zone', () => {
    process.env.WORDHOLD_OWNER_TIME_ZONE = 'Berlin';
    expect(() => serverEnv.ownerTimeZone()).toThrow(
      'Invalid IANA time zone in WORDHOLD_OWNER_TIME_ZONE: Berlin',
    );
  });

  it('accepts an explicit HTTP origin', () => {
    process.env.WORDHOLD_PUBLIC_URL = 'https://wordhold.vornholt.online';
    expect(serverEnv.publicUrl()).toBe('https://wordhold.vornholt.online');
  });

  it('rejects a public URL with credentials or a path', () => {
    process.env.WORDHOLD_PUBLIC_URL =
      'https://owner:secret@wordhold.vornholt.online/path';
    expect(() => serverEnv.publicUrl()).toThrow(
      'WORDHOLD_PUBLIC_URL must be an HTTP(S) origin',
    );
  });

  it('rejects a malformed public URL with the configuration error', () => {
    process.env.WORDHOLD_PUBLIC_URL = 'not a URL';
    expect(() => serverEnv.publicUrl()).toThrow(
      'WORDHOLD_PUBLIC_URL must be an HTTP(S) origin',
    );
  });
});
