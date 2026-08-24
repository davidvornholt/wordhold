import { describe, expect, it } from 'bun:test';
import { file as bunFile } from 'bun';

const tokenSets = async (): Promise<{
  light: ReadonlySet<string>;
  dark: ReadonlySet<string>;
}> => {
  const css = await bunFile(new URL('./theme.css', import.meta.url)).text();
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

describe('theme tokens', () => {
  it('override every color token in dark mode', async () => {
    const { light, dark } = await tokenSets();
    const nonColor = new Set(['--radius', '--font-display', '--font-body']);
    const colorTokens = [...light].filter((token) => !nonColor.has(token));
    expect(colorTokens.length).toBeGreaterThan(0);
    for (const token of colorTokens) {
      expect(dark).toContain(token);
    }
  });

  it('declare no dark-only tokens', async () => {
    const { light, dark } = await tokenSets();
    for (const token of dark) {
      expect(light).toContain(token);
    }
  });
});
