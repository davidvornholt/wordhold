import { describe, expect, it } from 'bun:test';
import { resolveSessionDirection, sessionOptions } from './session-options';

describe('sessionOptions', () => {
  it('offers a mixed sitting only when both directions are practised', () => {
    expect(
      sessionOptions(['to_target', 'to_native'], 'Englisch').map(
        (option) => option.value,
      ),
    ).toEqual(['to_target', 'to_native', 'both']);
  });

  it('drops a direction the course switched off, and the mix with it', () => {
    expect(
      sessionOptions(['to_native'], 'Englisch').map((option) => option.value),
    ).toEqual(['to_native']);
  });

  it('keeps the German-first direction first however the course stores it', () => {
    expect(
      sessionOptions(['to_native', 'to_target'], 'Englisch').at(0)?.value,
    ).toBe('to_target');
  });
});

describe('resolveSessionDirection', () => {
  it('honours a direction the course still practises', () => {
    expect(
      resolveSessionDirection('to_native', ['to_target', 'to_native']),
    ).toBe('to_native');
  });

  it('ignores a direction the course switched off', () => {
    expect(resolveSessionDirection('to_native', ['to_target'])).toBe(
      'to_target',
    );
  });

  it('refuses a mixed sitting when only one direction is left', () => {
    expect(resolveSessionDirection('both', ['to_target'])).toBe('to_target');
  });

  it('asks first when nothing was requested and there is a choice', () => {
    expect(
      resolveSessionDirection(undefined, ['to_target', 'to_native']),
    ).toBeUndefined();
  });
});
