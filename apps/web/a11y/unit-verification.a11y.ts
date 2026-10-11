import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const unitTwoId = '11111111-1111-4111-8111-111111111111';
const unitThreeId = '22222222-2222-4222-8222-222222222222';
const unitChangeLabel = /^Einheit ab Eintrag/u;

test('VerifyForm files the whole page into the unit detected from the photo', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  const unit = page.getByLabel('Einheit', { exact: true });
  await expect(unit).toHaveValue(unitTwoId);
  await expect(unit).not.toBeFocused();
  await expect(
    page.getByRole('list', { name: 'Unit 2: Einträge 1–12' }),
  ).toBeVisible();
  await expect(page.getByLabel(unitChangeLabel)).toHaveCount(0);
});

test('VerifyForm files the rest of the page into the next unit from one entry onward', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  await page
    .getByRole('button', { name: 'Andere Einheit ab Eintrag 7' })
    .click();

  // The new run starts in the book's next unit, with the cursor on its
  // picker in case the page moved on to another one.
  const laterUnit = page.getByLabel('Einheit ab Eintrag 7', { exact: true });
  await expect(laterUnit).toBeFocused();
  await expect(laterUnit).toHaveValue(unitThreeId);
  await expect(page.getByLabel('Einheit', { exact: true })).toHaveValue(
    unitTwoId,
  );
  await expect(
    page.getByRole('list', { name: 'Unit 2: Einträge 1–6' }),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Unit 3: Einträge 7–12' }),
  ).toBeVisible();
  // A run's first row starts it already, so it offers no split.
  await expect(
    page.getByRole('button', { name: 'Andere Einheit ab Eintrag 7' }),
  ).toHaveCount(0);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
  await expect(
    page.getByRole('list', { name: 'Unit 3: Einträge 7–13' }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: 'Einheitenwechsel ab Eintrag 7 aufheben' })
    .click();
  await expect(
    page.getByRole('list', { name: 'Unit 2: Einträge 1–13' }),
  ).toBeVisible();
  await expect(page.getByLabel(unitChangeLabel)).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Andere Einheit ab Eintrag 7' }),
  ).toBeFocused();
});

test('VerifyForm files the whole page into a named new unit', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  await page.getByLabel('Einheit', { exact: true }).selectOption('new');
  const name = page.getByLabel('Name der Einheit');
  const submit = page.getByRole('button', { name: '12 Einträge importieren' });
  await expect(name).toHaveAttribute('required', '');
  await expect(submit).toBeDisabled();
  await name.fill('Unit 4');
  await expect(submit).toBeEnabled();
  await expect(
    page.getByRole('list', { name: 'Unit 4 (neu): Einträge 1–12' }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm keeps its filing and unit changes usable on a narrow phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/?state=verification');
  const book = page.getByLabel('Buch', { exact: true });
  await book.scrollIntoViewIfNeeded();
  await expect(book).toBeInViewport();
  const unit = page.getByLabel('Einheit', { exact: true });
  await unit.scrollIntoViewIfNeeded();
  await expect(unit).toBeInViewport();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth ===
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  const split = page.getByRole('button', {
    name: 'Andere Einheit ab Eintrag 2',
  });
  await split.scrollIntoViewIfNeeded();
  await expect(split).toBeInViewport();
  await split.click();
  const laterUnit = page.getByLabel('Einheit ab Eintrag 2', { exact: true });
  await expect(laterUnit).toBeInViewport();
  await laterUnit.selectOption('new');
  const name = page.getByLabel('Name der Einheit');
  await name.scrollIntoViewIfNeeded();
  await expect(name).toBeInViewport();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth ===
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
