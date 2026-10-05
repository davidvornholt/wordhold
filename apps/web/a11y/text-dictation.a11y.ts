import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';
import { verse } from './text-fixture-data';

// Playwright's Page type reaches this file only through the test fixtures.
type Page = Parameters<Parameters<typeof test>[2]>[0]['page'];

// Chromium's fake microphone plays a tone, and each test answers the
// recognition itself, so no recording leaves the browser.
test.use({
  contextOptions: { reducedMotion: 'reduce' },
  permissions: ['microphone'],
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
});

const typedStart = 'Also hat Gott die Welt geliebt,';
// Recognition cannot hear "daß" apart from "das".
const spokenRest = verse.slice(typedStart.length + 1).replaceAll('daß', 'das');
const stopLabel = /^Aufnahme beenden/u;
const recognitionFailed =
  'Die Aufnahme konnte nicht in Text umgewandelt werden. Versuche es noch einmal.';

const startTyping = async (page: Page) => {
  await page.goto('/?state=texts-practice');
  const answer = page.getByLabel('Deine Antwort');
  await answer.fill(typedStart);
  return answer;
};

// Records for a second, so there is audio to send.
const dictate = async (page: Page) => {
  await page.getByRole('button', { name: 'Diktieren' }).click();
  const stop = page.getByRole('button', { name: stopLabel });
  await expect(stop).toContainText('0:01');
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Weiß ich nicht' }),
  ).toBeDisabled();
  await stop.click();
};

test('a spoken text joins the typed start and forgives words that sound right', async ({
  page,
}) => {
  const uploads: Array<{
    readonly type: string | null;
    readonly bytes: number;
  }> = [];
  await page.route('**/api/dictations', async (route) => {
    const request = route.request();
    uploads.push({
      type: await request.headerValue('content-type'),
      bytes: request.postDataBuffer()?.byteLength ?? 0,
    });
    await route.fulfill({ json: { transcript: spokenRest } });
  });
  const answer = await startTyping(page);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await dictate(page);
  await expect(answer).toHaveValue(`${typedStart} ${spokenRest}`);
  expect(uploads).toHaveLength(1);
  const [upload] = uploads;
  expect(upload?.type).toBe('audio/pcm; rate=16000; channels=1');
  // At least a second of 16-bit samples at 16 kHz, in whole samples.
  expect(upload?.bytes).toBeGreaterThanOrEqual(32_000);
  expect((upload?.bytes ?? 1) % 2).toBe(0);

  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByText('Richtig', { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      '2 gleich klingende Wörter bei 27 Wörtern. Gleich klingende Wörter zählen nicht als Fehler.',
    ),
  ).toBeVisible();
  await expect(page.getByText('daß (gehört als das)')).toHaveCount(2);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('a failed recognition says so and keeps the typed answer', async ({
  page,
}) => {
  await page.route('**/api/dictations', (route) =>
    route.fulfill({ status: 502, json: { error: recognitionFailed } }),
  );
  const answer = await startTyping(page);

  await dictate(page);
  await expect(page.getByRole('alert')).toHaveText(recognitionFailed);
  await expect(answer).toHaveValue(typedStart);
  await expect(page.getByRole('button', { name: 'Diktieren' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Prüfen' })).toBeEnabled();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('a blocked microphone says how to allow it', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  });
  await startTyping(page);

  await page.getByRole('button', { name: 'Diktieren' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Wordhold darf das Mikrofon nicht benutzen. Erlaube es in den Einstellungen deines Browsers.',
  );
  await expect(page.getByRole('button', { name: 'Diktieren' })).toBeEnabled();
});

test('an unanswered microphone prompt does not hold up the answer', async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => new Promise(() => undefined);
  });
  await page.goto('/?state=texts-practice');
  await page.getByLabel('Deine Antwort').fill(verse);

  await page.getByRole('button', { name: 'Diktieren' }).click();
  await expect(
    page.getByRole('button', { name: 'Mikrofon wird gestartet …' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByText('Richtig', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Mikrofon wird gestartet …' }),
  ).toHaveCount(0);
});

test('only texts are dictated', async ({ page }) => {
  await page.goto('/?state=terms-practice');
  await expect(page.getByLabel('Deine Antwort')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Diktieren' })).toHaveCount(0);
});
