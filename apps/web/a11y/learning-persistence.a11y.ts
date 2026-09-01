import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('the learning pass announces a persistence failure and retries the same entry', async ({
  page,
}) => {
  await page.goto('/?state=learn-retry');
  const field = page.getByLabel('Schreib die Antwort');
  await field.fill('memory');
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'Die Vokabel wurde nicht gespeichert. Versuch es noch einmal.',
  );
  await expect(page.getByText('0 von 2 Vokabeln kennengelernt')).toBeVisible();
  await expect(page.getByLabel('Introduced directions')).toHaveText('0');
  await expect(page.getByLabel('Introduction attempts')).toHaveText('1');

  await expect(field).toBeFocused();
  await field.press('Enter');
  await expect(page.getByText('1 von 2 Vokabeln kennengelernt')).toBeVisible();
  await expect(field).toBeFocused();
  await expect(page.getByLabel('Introduced directions')).toHaveText('1');
  await expect(page.getByLabel('Introduction attempts')).toHaveText('2');
});

test('the learning pass clears a save failure before checking a correction', async ({
  page,
}) => {
  await page.goto('/?state=learn-retry');
  const field = page.getByLabel('Schreib die Antwort');
  await field.fill('memory');
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await field.fill('remember');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(
    page.getByText('Noch nicht ganz. Schreib die Vokabel genau so ab.'),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('');
  await expect(page.getByLabel('Introduction attempts')).toHaveText('1');

  await field.fill('memory');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('1 von 2 Vokabeln kennengelernt')).toBeVisible();
  await expect(page.getByLabel('Introduced directions')).toHaveText('1');
  await expect(page.getByLabel('Introduction attempts')).toHaveText('2');
});
