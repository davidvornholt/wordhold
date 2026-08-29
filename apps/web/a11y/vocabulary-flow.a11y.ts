import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('the vocabulary library exposes per-direction dates and cross-unit selection', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary');
  await page.locator('summary').first().click();
  await expect(page.getByText('Deutsch → Englisch').first()).toBeVisible();
  await expect(page.getByText('Englisch → Deutsch').first()).toBeVisible();
  await expect(page.getByText('nicht gewusst').first()).toBeVisible();

  await page.getByLabel('memory auswählen').check();
  await page.getByLabel('the referee auswählen').check();
  await expect(page.getByText('2 ausgewählt')).toBeVisible();
  await page.getByRole('button', { name: 'Frei üben' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'study-start',
  );
});

test('difficult vocabulary can be selected as one practice set', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary-difficult');
  await page
    .getByRole('button', { name: 'Schwierige Vokabeln auswählen' })
    .click();
  await expect(page.getByText('1 ausgewählt')).toBeVisible();
});
