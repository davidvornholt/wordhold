import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const providerName = /Amazon Polly/u;
const technicalAudioLabel = /Audio/u;

test('a failed import recovers pronunciation without user action', async ({
  page,
}) => {
  await page.goto('/?state=signed-out');
  await page.evaluate(() => sessionStorage.clear());

  await page.goto('/?state=dashboard-audio-recovery');
  await expect(
    page.getByRole('heading', { name: 'Aussprache folgt automatisch' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Offene Importe' }),
  ).toHaveCount(0);
  await expect(page.getByText(providerName)).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: technicalAudioLabel }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: technicalAudioLabel }),
  ).toHaveCount(0);

  await page.goto('/?state=verification-audio-recovery');

  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'dashboard-audio-recovery',
  );
  await expect(
    page.getByRole('heading', { name: 'Aussprache wird erstellt' }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Aussprache wird erstellt' }),
  ).toHaveCount(0);
});

test('verification announces recovery and offers another attempt after failure', async ({
  page,
}) => {
  await page.goto('/?state=verification-audio-recovery-deferred');
  await expect(page.getByRole('status')).toHaveText(
    'Aussprache wird erstellt …',
  );

  await page.getByRole('button', { name: 'Reject pronunciation' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Die Aussprache konnte noch nicht erstellt werden.',
  );
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Aussprache wird erstellt …',
  );

  await page.getByRole('button', { name: 'Resolve pronunciation' }).click();
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
});

test('a completed recovery cannot pull the learner away from the page stack', async ({
  page,
}) => {
  await page.goto('/?state=verification-audio-recovery-deferred');
  await expect(page.getByRole('status')).toHaveText(
    'Aussprache wird erstellt …',
  );
  await page.getByRole('button', { name: 'Seitenstapel' }).click();
  await expect(
    page.getByRole('heading', { name: 'Seiten im Stapel' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Resolve pronunciation' }).click();
  await expect(
    page.getByRole('heading', { name: 'Seiten im Stapel' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toHaveCount(0);
});

test('verification uses the production image and extraction retry names', async ({
  page,
}) => {
  await page.goto('/?state=verification-empty');
  await expect(
    page.getByRole('img', { name: 'Fotografierte Vokabelseite' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Erneut auslesen' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'verification',
  );
});
