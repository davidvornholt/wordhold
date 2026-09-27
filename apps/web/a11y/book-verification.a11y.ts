import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const earlierBookId = '55555555-5555-4555-8555-555555555555';
const currentBookId = '66666666-6666-4666-8666-666666666666';
const earlierUnitId = '44444444-4444-4444-8444-444444444444';
const currentUnitId = '11111111-1111-4111-8111-111111111111';
// The earlier book's one unit, "Keine Einheit" and "Neue Einheit".
const earlierBookUnitOptions = 3;

test('VerifyForm starts in the book that received words last', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  await expect(page.getByLabel('Buch dieser Seite')).toHaveValue(currentBookId);
  await expect(page.getByLabel('Einheit für alle Vokabeln')).toHaveValue(
    currentUnitId,
  );
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm files every row into the unit of a newly picked book', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  await page.getByLabel('Buch dieser Seite').selectOption(earlierBookId);
  await expect(page.getByLabel('Einheit für alle Vokabeln')).toHaveValue(
    earlierUnitId,
  );
  const firstRow = page.locator('form > ul > li').first();
  await firstRow
    .getByRole('button', { name: 'Einheit für Eintrag 1 ändern' })
    .click();
  const rowUnit = firstRow.getByLabel('Einheit für Eintrag 1');
  await expect(rowUnit).toHaveValue(earlierUnitId);
  await expect(rowUnit.locator('option')).toHaveCount(earlierBookUnitOptions);
});

test('VerifyForm asks for the name of a new book before importing', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  await page.getByLabel('Buch dieser Seite').selectOption('new');
  const bookName = page.getByLabel('Name des Buchs');
  await expect(bookName).toHaveAttribute('required', '');
  const submit = page.getByRole('button', { name: '12 Einträge importieren' });
  await expect(submit).toBeDisabled();
  await expect(page.getByLabel('Einheit für alle Vokabeln')).toHaveValue('new');
  await bookName.fill('Green Line 4');
  await expect(submit).toBeEnabled();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm files a page without a unit heading directly into a new book', async ({
  page,
}) => {
  await page.goto('/?state=verification-deferred');
  await page.getByLabel('Buch dieser Seite').selectOption('new');
  await page.getByLabel('Name des Buchs').fill('The Hobbit');
  await expect(page.getByLabel('Einheit für alle Vokabeln')).toHaveValue(
    'none',
  );
  await expect(page.getByLabel('Name der Einheit')).toHaveCount(0);
  await page.getByRole('button', { name: '1 Eintrag importieren' }).click();
  const snapshot = page.getByLabel('Verification snapshot');
  await expect(snapshot).toContainText(
    '"book":{"kind":"new","name":"The Hobbit"}',
  );
  await expect(snapshot).toContainText('"unit":{"kind":"none"}');
});
