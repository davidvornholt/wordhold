import { describe, expect, it } from 'bun:test';
import { file as bunFile } from 'bun';

const collect = (chunk: string): ReadonlySet<string> =>
  new Set(
    [...chunk.matchAll(/(?<token>--[a-z-]+):/gu)].flatMap(
      (match) => match.groups?.token ?? [],
    ),
  );

const tokenSets = async (): Promise<{
  light: ReadonlySet<string>;
  dark: ReadonlySet<string>;
  reducedMotion: ReadonlySet<string>;
}> => {
  const css = await bunFile(new URL('./theme.css', import.meta.url)).text();
  const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
  const reducedMotionStart = css.indexOf(
    '@media (prefers-reduced-motion: reduce)',
  );
  return {
    light: collect(css.slice(0, darkStart)),
    dark: collect(css.slice(darkStart, reducedMotionStart)),
    reducedMotion: collect(css.slice(reducedMotionStart)),
  };
};

const isColorToken = (token: string): boolean =>
  !(
    token === '--radius' ||
    token.startsWith('--font-') ||
    token.startsWith('--motion-')
  );

describe('theme tokens', () => {
  it('override every color token in dark mode', async () => {
    const { light, dark } = await tokenSets();
    const colorTokens = [...light].filter(isColorToken);
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

  it('zero every motion duration under reduced motion', async () => {
    const { light, reducedMotion } = await tokenSets();
    const durations = [...light].filter(
      (token) => token.startsWith('--motion-') && !token.includes('ease'),
    );
    expect(durations.length).toBeGreaterThan(0);
    for (const token of durations) {
      expect(reducedMotion).toContain(token);
    }
  });
});
