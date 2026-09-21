import { describe, expect, it } from 'bun:test';
import { focusShell, usesFocusShell } from './shell';

describe('usesFocusShell', () => {
  it('drops the top bar when any match asks for the focus shell', () => {
    expect(
      usesFocusShell([{ staticData: {} }, { staticData: focusShell }]),
    ).toBe(true);
  });

  it('keeps the top bar for ordinary pages', () => {
    expect(usesFocusShell([{ staticData: {} }, { staticData: {} }])).toBe(
      false,
    );
  });
});
