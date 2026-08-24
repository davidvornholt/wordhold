import { describe, expect, it } from 'bun:test';
import { privateMediaResponse } from './media-response';

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
