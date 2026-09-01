import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('the learning pass starts the example sentence only once', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const playedUrls: Array<string> = [];
    const pausedUrls: Array<string> = [];
    let activeAudio: AudioFixture | null = null;
    class AudioFixture {
      playing = false;
      readonly source: string;
      constructor(source: string) {
        this.source = source;
      }
      pause() {
        this.playing = false;
        pausedUrls.push(this.source);
      }
      play() {
        this.playing = true;
        activeAudio = this;
        playedUrls.push(this.source);
        return Promise.resolve();
      }
    }
    Object.defineProperty(globalThis, 'Audio', { value: AudioFixture });
    Object.defineProperty(globalThis, '__audioUrls', {
      get: () => playedUrls,
    });
    Object.defineProperty(globalThis, '__audioPausedUrls', {
      get: () => pausedUrls,
    });
    Object.defineProperty(globalThis, '__audioPlaying', {
      get: () => activeAudio?.playing ?? false,
    });
  });
  await page.goto('/?state=learn-audio');
  await expect(
    page.getByText('This memory still makes me smile.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Satz anhören' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Wort anhören' }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(globalThis, '__audioUrls')))
    .toEqual([
      '/api/entries/00000000-0000-0000-0000-000000000001/example-audio',
    ]);
  await page.getByRole('button', { name: 'Audio stoppen' }).click();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(globalThis, '__audioPlaying')))
    .toBe(false);
  await expect
    .poll(() =>
      page.evaluate(() => Reflect.get(globalThis, '__audioPausedUrls')),
    )
    .toEqual([
      '/api/entries/00000000-0000-0000-0000-000000000001/example-audio',
    ]);
});
