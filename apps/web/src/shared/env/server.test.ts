import { afterEach, describe, expect, it } from 'bun:test';
import process from 'node:process';
import { serverEnv } from './server';

const original = process.env.AUTH_SECRET;

afterEach(() => {
  if (original === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = original;
  }
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
});
