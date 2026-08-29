import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('a failed import stays reachable until audio retry succeeds', async ({
  page,
}) => {
  await page.goto('/?state=signed-out');
  await page.evaluate(() => sessionStorage.clear());

  await page.goto('/?state=verification-audio-recovery');
  await expect(page.getByText('1 Audiodatei fehlt noch.')).toBeVisible();
  await page.getByRole('button', { name: 'Übersicht' }).click();

  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'dashboard-audio-recovery',
  );
  await expect(
    page.getByRole('heading', { name: 'Fehlendes Audio' }),
  ).toBeVisible();
  const recoveryLink = page.getByRole('link', {
    name: 'Audio für English A2 (24.8.2026) ergänzen',
  });
  await expect(recoveryLink).toBeVisible();
  await recoveryLink.click();

  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'verification-audio-recovery',
  );
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Fehlende Audiodateien erstellen' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Fehlende Audiodateien erstellen' })
    .click();

  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'dashboard-audio-recovery',
  );
  await expect(
    page.getByRole('heading', { name: 'Fehlendes Audio' }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Fehlendes Audio' }),
  ).toHaveCount(0);
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
