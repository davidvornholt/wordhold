import { describe, expect, it } from 'bun:test';
import { AuthenticationError } from '../auth/authentication-error';
import { NotOwnedError } from '../auth/ownership';
import { MediaNotFoundError } from './media-not-found-error';
import { mediaErrorResponse, privateMediaResponse } from './media-response';

describe('privateMediaResponse', () => {
  it('prevents authenticated media from being stored by browsers or shared caches', () => {
    const response = privateMediaResponse(
      new Uint8Array(new ArrayBuffer(1)),
      'image/jpeg',
    );

    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-type')).toBe('image/jpeg');
  });
});

describe('mediaErrorResponse', () => {
  it('asks a request without a session to sign in', () => {
    const response = mediaErrorResponse(
      new AuthenticationError({ message: 'Nicht angemeldet.' }),
    );

    expect(response.status).toBe(401);
  });

  it('reports a stranger’s medium like a missing one', () => {
    expect(
      mediaErrorResponse(new NotOwnedError({ message: 'Nicht gefunden.' }))
        .status,
    ).toBe(404);
    expect(
      mediaErrorResponse(new MediaNotFoundError({ message: 'Fehlt.' })).status,
    ).toBe(404);
  });

  it('leaves any other failure to the server', () => {
    const failure = new Error('disk unavailable');

    expect(() => mediaErrorResponse(failure)).toThrow(failure);
  });
});
