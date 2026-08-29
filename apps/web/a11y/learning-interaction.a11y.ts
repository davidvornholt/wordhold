import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// Nothing in the learning pass is graded, but it does decide which entries the
// scheduler is allowed to ask about, so an entry must not count as met until it
// has actually been written correctly.
test('the learning pass asks again for a wrong copy and records only the correct ones', async ({
  page,
}) => {
  await page.goto('/?state=learn');
  const field = page.getByLabel('Schreib die Vokabel ab');
  const advance = page.getByRole('button', { name: 'Weiter' });
  await expect(page.getByText('Vokabel 1 von 2')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'memory' }),
  ).toBeFocused();

  await field.fill('remember');
  await advance.click();
  await expect(
    page.getByText('Noch nicht ganz. Schreib die Vokabel genau so ab.'),
  ).toBeVisible();
  await expect(field).toHaveValue('');
  await expect(advance).toBeDisabled();
  await expect(field).toBeFocused();
  await expect(page.getByText('Vokabel 1 von 2')).toBeVisible();
  await expect(page.getByLabel('Introduced entries')).toHaveText('0');

  await field.fill('Memory');
  await advance.click();
  await expect(page.getByText('Vokabel 2 von 2')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'to look (at)' }),
  ).toBeFocused();
  await expect(page.getByLabel('Introduced entries')).toHaveText('1');

  await page.getByLabel('Schreib die Vokabel ab').fill('to look at');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Einheit gelernt!' }),
  ).toBeFocused();
  await expect(page.getByLabel('Introduced entries')).toHaveText('2');
});

test('the learning pass announces a persistence failure and retries the same entry', async ({
  page,
}) => {
  await page.goto('/?state=learn-retry');
  const field = page.getByLabel('Schreib die Vokabel ab');
  await field.fill('memory');
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'Die Vokabel wurde nicht gespeichert. Versuch es noch einmal.',
  );
  await expect(page.getByText('Vokabel 1 von 2')).toBeVisible();
  await expect(page.getByLabel('Introduced entries')).toHaveText('0');
  await expect(page.getByLabel('Introduction attempts')).toHaveText('1');

  const retry = page.getByRole('button', { name: 'Erneut versuchen' });
  await expect(retry).toBeFocused();
  await retry.click();
  await expect(page.getByText('Vokabel 2 von 2')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'to look (at)' }),
  ).toBeFocused();
  await expect(page.getByLabel('Introduced entries')).toHaveText('1');
  await expect(page.getByLabel('Introduction attempts')).toHaveText('2');
});

test('the learning pass clears a save failure before checking a correction', async ({
  page,
}) => {
  await page.goto('/?state=learn-retry');
  const field = page.getByLabel('Schreib die Vokabel ab');
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
  await expect(page.getByText('Vokabel 2 von 2')).toBeVisible();
  await expect(page.getByLabel('Introduced entries')).toHaveText('1');
  await expect(page.getByLabel('Introduction attempts')).toHaveText('2');
});
