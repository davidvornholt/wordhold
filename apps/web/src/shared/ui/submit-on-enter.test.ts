import { describe, expect, it } from 'bun:test';
import type { KeyboardEvent } from 'react';
import { submitOnEnter, submitOnEveryEnter } from './submit-on-enter';

// A keydown in a field of a form without a submit button, counting the
// submissions it causes.
const press = (
  handler: (event: KeyboardEvent<HTMLTextAreaElement>) => void,
  key: { readonly shiftKey?: boolean; readonly keyCode?: number } = {},
): number => {
  let submissions = 0;
  const event = {
    key: 'Enter',
    shiftKey: key.shiftKey ?? false,
    nativeEvent: { isComposing: false, keyCode: key.keyCode ?? 13 },
    preventDefault: () => undefined,
    currentTarget: {
      form: {
        elements: [],
        requestSubmit: () => {
          submissions += 1;
        },
      },
    },
  } as unknown as KeyboardEvent<HTMLTextAreaElement>;
  handler(event);
  return submissions;
};

describe('submitOnEnter', () => {
  it('submits on Enter and leaves Shift+Enter to start a new line', () => {
    expect(press(submitOnEnter)).toBe(1);
    expect(press(submitOnEnter, { shiftKey: true })).toBe(0);
  });

  it('does not submit on the Enter that picks a candidate in Safari', () => {
    expect(press(submitOnEnter, { keyCode: 229 })).toBe(0);
    expect(press(submitOnEveryEnter, { keyCode: 229 })).toBe(0);
  });
});

describe('submitOnEveryEnter', () => {
  it('submits on Enter with or without Shift', () => {
    expect(press(submitOnEveryEnter)).toBe(1);
    expect(press(submitOnEveryEnter, { shiftKey: true })).toBe(1);
  });
});
