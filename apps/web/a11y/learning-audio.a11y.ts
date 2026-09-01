import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('the learning pass starts the example sentence only once', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const playedUrls: Array<string> = [];
    class AudioFixture {
      playing = false;
      readonly source: string;
      constructor(source: string) {
        this.source = source;
      }
      pause() {
        this.playing = false;
      }
      play() {
        this.playing = true;
        playedUrls.push(this.source);
        return Promise.resolve();
      }
    }
    Object.defineProperty(globalThis, 'Audio', { value: AudioFixture });
    Object.defineProperty(globalThis, '__audioUrls', {
      get: () => playedUrls,
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
});
