import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const exceptionCheckbox = /Als Ausnahme importieren/u;
const dashboardState = /state=dashboard/u;

test('VerifyForm flags stored duplicates and skips them by default', async ({
  page,
}) => {
  await page.goto('/?state=verification-duplicates');
  await expect(page.getByText('Schon in dieser Einheit')).toHaveCount(2);
  const journeyRow = page.locator('form > ul > li').first();
  await expect(
    journeyRow.getByText('Wird nicht erneut importiert'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '10 Einträge importieren' }),
  ).toBeEnabled();
  await expect(
    page.getByText('2 Duplikate werden nicht importiert.'),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm completes a page containing only exact duplicates', async ({
  page,
}) => {
  await page.goto('/?state=verification-all-duplicates');
  await expect(
    page.getByText('12 Duplikate werden nicht importiert.'),
  ).toBeVisible();
  const complete = page.getByRole('button', { name: 'Seite abschließen' });
  await expect(complete).toBeEnabled();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await complete.click();
  await expect(page).toHaveURL(dashboardState);
});

test('VerifyForm imports a variant only after the exception is confirmed', async ({
  page,
}) => {
  await page.goto('/?state=verification-duplicates');
  const luggageRow = page.locator('form > ul > li').nth(1);
  await luggageRow.getByRole('checkbox', { name: exceptionCheckbox }).check();
  await expect(
    page.getByRole('button', { name: '11 Einträge importieren' }),
  ).toBeEnabled();
  await expect(
    page.getByText('1 Duplikat wird nicht importiert.'),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm turns an exact duplicate into an exception when the example changes', async ({
  page,
}) => {
  await page.goto('/?state=verification-duplicates');
  const journeyRow = page.locator('form > ul > li').first();
  await expect(
    journeyRow.getByRole('checkbox', { name: exceptionCheckbox }),
  ).toHaveCount(0);
  await journeyRow.getByLabel('Beispielsatz').fill('A long journey home.');
  await journeyRow.getByRole('checkbox', { name: exceptionCheckbox }).check();
  await expect(
    page.getByRole('button', { name: '11 Einträge importieren' }),
  ).toBeEnabled();
});

test('VerifyForm voids a confirmed exception when the text is edited again', async ({
  page,
}) => {
  await page.goto('/?state=verification-duplicates');
  const luggageRow = page.locator('form > ul > li').nth(1);
  await luggageRow.getByRole('checkbox', { name: exceptionCheckbox }).check();
  await luggageRow.getByLabel('Englisch').fill('luggage!');
  await expect(
    luggageRow.getByRole('checkbox', { name: exceptionCheckbox }),
  ).not.toBeChecked();
  await expect(
    page.getByRole('button', { name: '10 Einträge importieren' }),
  ).toBeEnabled();
});
