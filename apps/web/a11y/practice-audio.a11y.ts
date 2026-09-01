import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

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

test('practice reveals and plays the sentence only after a graded answer', async ({
  page,
}) => {
  await page.addInitScript(audioRecorderScript);
  await page.goto('/?state=practice-session&late-example=true');
  const sentence = page.getByText('This memory still makes me smile.');
  await expect(sentence).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => Reflect.get(globalThis, '__audioUrls')))
    .toEqual([]);

  await page.getByLabel('Deine Antwort').fill('memory');
  await page.getByRole('button', { name: 'Prüfen' }).click();

  await expect(sentence).toBeVisible();
  await expect(
    page.getByText('Diese Erinnerung bringt mich immer noch zum Lächeln.'),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(globalThis, '__audioUrls')))
    .toEqual([
      '/api/entries/0000000-0000-0000-0000-000000000101/example-audio',
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
      '/api/entries/0000000-0000-0000-0000-000000000101/example-audio',
    ]);
});

test('an ungraded answer neither reveals nor plays the sentence', async ({
  page,
}) => {
  await page.addInitScript(audioRecorderScript);
  await page.goto('/?state=practice-session&late-example=true');
  await page.getByLabel('Deine Antwort').fill('ungraded');
  await page.getByRole('button', { name: 'Prüfen' }).click();

  await expect(
    page.getByText('Der KI-Prüfer ist gerade nicht erreichbar.'),
  ).toBeVisible();
  await expect(page.getByText('This memory still makes me smile.')).toHaveCount(
    0,
  );
  await expect
    .poll(() => page.evaluate(() => Reflect.get(globalThis, '__audioUrls')))
    .toEqual([]);
});

test('pending feedback preparation cannot outlive its practice card', async ({
  page,
}) => {
  await page.addInitScript(audioRecorderScript);
  await page.goto('/?state=practice-session&deferred-example=true');
  await page.getByLabel('Deine Antwort').fill('memory');
  await page.getByRole('button', { name: 'Prüfen' }).click();

  await expect(page.getByText('Richtig')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeDisabled();

  await page.getByRole('button', { name: 'Sitzung ausblenden' }).click();
  await page.getByRole('button', { name: 'Beispielsatz freigeben' }).click();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(globalThis, '__audioUrls')))
    .toEqual([]);
});
