import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// Playwright's Page type reaches this file only through the test fixtures.
type Page = Parameters<Parameters<typeof test>[2]>[0]['page'];

const audioRecorderScript = () => {
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
};

const playedUrls = (page: Page) =>
  page.evaluate(() => Reflect.get(globalThis, '__audioUrls'));

const wordAudio = '/api/entries/00000000-0000-0000-0000-000000000001/audio';
const sentenceAudio =
  '/api/entries/00000000-0000-0000-0000-000000000001/example-audio';

test('the learning pass starts the example sentence only once', async ({
  page,
}) => {
  await page.addInitScript(audioRecorderScript);
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

test('a new word shows before its example sentence is ready', async ({
  page,
}) => {
  await page.addInitScript(audioRecorderScript);
  await page.goto('/?state=learn-deferred');
  const preparing = page.getByRole('status').filter({
    hasText: 'Beispielsatz wird vorbereitet …',
  });
  const sentence = page.getByText('This memory still makes me smile.');

  await expect(
    page.getByRole('heading', { level: 2, name: 'die Erinnerung' }),
  ).toBeVisible();
  await expect(page.getByLabel('Schreib die Antwort')).toBeFocused();
  await expect(preparing).toBeVisible();
  await expect(sentence).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Wort anhören' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Satz anhören' })).toHaveCount(
    0,
  );
  await expect.poll(() => playedUrls(page)).toEqual([]);

  await page.getByRole('button', { name: 'Beispielsatz freigeben' }).click();
  await expect(sentence).toBeVisible();
  await expect(preparing).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Satz anhören' }),
  ).toBeVisible();
  await expect.poll(() => playedUrls(page)).toEqual([sentenceAudio]);

  // The next word waits for its own sentence and plays nothing meanwhile.
  await page.getByLabel('Schreib die Antwort').fill('memory');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'die Ferien' }),
  ).toBeVisible();
  await expect(preparing).toBeVisible();
  expect(await playedUrls(page)).toEqual([sentenceAudio]);
});

test('a word whose example cannot be prepared is learned without one', async ({
  page,
}) => {
  await page.addInitScript(audioRecorderScript);
  await page.goto('/?state=learn-deferred&failed-example=true');

  await expect(
    page.getByRole('heading', { level: 2, name: 'die Erinnerung' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Wort anhören' }),
  ).toBeVisible();
  await expect(page.getByText('Beispielsatz wird vorbereitet …')).toHaveCount(
    0,
  );
  await expect(page.getByText('Im Satz')).toHaveCount(0);
  await expect.poll(() => playedUrls(page)).toEqual([wordAudio]);

  await page.getByLabel('Schreib die Antwort').fill('memory');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'die Ferien' }),
  ).toBeVisible();
  await expect(page.getByText('von 2 Vokabeln kennengelernt')).toHaveText(
    '1 von 2 Vokabeln kennengelernt · Deutsch → Englisch',
  );
});

test('an example prepared after its card has gone does not play', async ({
  page,
}) => {
  await page.addInitScript(audioRecorderScript);
  await page.goto('/?state=learn-deferred');
  await expect(page.getByText('Beispielsatz wird vorbereitet …')).toBeVisible();

  await page.getByRole('button', { name: 'Sitzung ausblenden' }).click();
  await page.getByRole('button', { name: 'Beispielsatz freigeben' }).click();
  await expect.poll(() => playedUrls(page)).toEqual([]);
});
