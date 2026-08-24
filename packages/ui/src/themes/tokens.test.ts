import { describe, expect, it } from 'bun:test';
import { file as bunFile } from 'bun';

const tokenSets = async (
  file: string,
): Promise<{ light: ReadonlySet<string>; dark: ReadonlySet<string> }> => {
  const css = await bunFile(new URL(file, import.meta.url)).text();
  const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
  const collect = (chunk: string): ReadonlySet<string> =>
    new Set(
      [...chunk.matchAll(/(?<token>--[a-z-]+):/gu)].flatMap(
        (match) => match.groups?.token ?? [],
      ),
    );
  return {
    light: collect(css.slice(0, darkStart)),
    dark: collect(css.slice(darkStart)),
  };
};

// The bake-off contract: both themes must declare the exact same semantic
// token names so the app can switch themes by swapping a wrapper class.
describe('bake-off themes', () => {
  it('declare identical light-mode token sets', async () => {
    const heirloom = await tokenSets('./heirloom.css');
    const warmPrint = await tokenSets('./warm-print.css');
    expect([...heirloom.light].sort()).toEqual([...warmPrint.light].sort());
  });

  it('declare identical dark-mode token sets', async () => {
    const heirloom = await tokenSets('./heirloom.css');
    const warmPrint = await tokenSets('./warm-print.css');
    expect([...heirloom.dark].sort()).toEqual([...warmPrint.dark].sort());
  });

  it('override every color token in dark mode', async () => {
    const { light, dark } = await tokenSets('./heirloom.css');
    const nonColor = new Set(['--radius', '--font-display', '--font-body']);
    const colorTokens = [...light].filter((token) => !nonColor.has(token));
    for (const token of colorTokens) {
      expect(dark).toContain(token);
    }
  });
});
