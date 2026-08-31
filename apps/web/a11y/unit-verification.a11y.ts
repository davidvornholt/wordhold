import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const unitTwoId = '11111111-1111-4111-8111-111111111111';
const unitThreeId = '22222222-2222-4222-8222-222222222222';
const boundaryIndex = 6;

test('VerifyForm selects the unit detected from the photographed page', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  await expect(page.getByLabel('Einheit für alle Vokabeln')).toHaveValue(
    unitTwoId,
  );
  const firstRow = page.locator('form > ul > li').first();
  await expect(
    firstRow.getByText('Einheit: Unit 2', { exact: true }),
  ).toBeVisible();
  await firstRow
    .getByRole('button', { name: 'Einheit für Eintrag 1 ändern' })
    .click();
  await expect(firstRow.getByLabel('Einheit für Eintrag 1')).toHaveValue(
    unitTwoId,
  );
});

test('VerifyForm assigns one unit to every entry or from one entry onward', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  const rows = page.locator('form > ul > li');

  await page.getByLabel('Einheit für alle Vokabeln').selectOption(unitTwoId);
  await page.getByRole('button', { name: 'Auf alle anwenden' }).click();
  const initialEntryCount = await rows.count();
  await expect(rows.getByText('Einheit: Unit 2', { exact: true })).toHaveCount(
    initialEntryCount,
  );

  const boundaryPosition = boundaryIndex + 1;
  await rows
    .nth(boundaryIndex)
    .getByRole('button', {
      name: `Einheit für Eintrag ${boundaryPosition} ändern`,
    })
    .click();
  await page
    .getByLabel(`Einheit für Eintrag ${boundaryPosition}`)
    .selectOption(unitThreeId);
  await page
    .getByRole('button', {
      name: `Einheit ab Vokabel ${boundaryPosition} anwenden`,
    })
    .click();

  // The boundary row keeps its open picker; every following row reports the
  // new unit in its collapsed summary, every earlier row keeps the old one.
  await expect(rows.getByText('Einheit: Unit 2', { exact: true })).toHaveCount(
    boundaryIndex,
  );
  await expect(rows.getByText('Einheit: Unit 3', { exact: true })).toHaveCount(
    initialEntryCount - boundaryPosition,
  );
  await expect(
    page.getByLabel(`Einheit für Eintrag ${boundaryPosition}`),
  ).toHaveValue(unitThreeId);

  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
  await expect(
    rows.last().getByText('Einheit: Unit 3', { exact: true }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm applies a named new unit to every entry', async ({ page }) => {
  await page.goto('/?state=verification');
  const bulkAssignment = page.getByRole('group', {
    name: 'Einheit zuordnen',
  });
  await bulkAssignment
    .getByLabel('Einheit für alle Vokabeln')
    .selectOption('new');
  const apply = bulkAssignment.getByRole('button', {
    name: 'Auf alle anwenden',
  });
  await expect(apply).toBeDisabled();
  await bulkAssignment.getByLabel('Name der Einheit').fill('Unit 4');
  await apply.click();

  const rows = page.locator('form > ul > li');
  await expect(
    rows.getByText('Einheit: Unit 4 (neu)', { exact: true }),
  ).toHaveCount(await rows.count());
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm remains usable in its existing and new-unit mobile states', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/?state=verification');
  await expect(
    page.getByRole('group', { name: 'Einheit zuordnen' }),
  ).toBeInViewport();
  const firstRow = page.locator('form > ul > li').first();
  const changeUnit = firstRow.getByRole('button', {
    name: 'Einheit für Eintrag 1 ändern',
  });
  await changeUnit.scrollIntoViewIfNeeded();
  await expect(changeUnit).toBeInViewport();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await changeUnit.click();
  const firstUnit = firstRow.getByLabel('Einheit für Eintrag 1');
  await firstUnit.scrollIntoViewIfNeeded();
  await expect(firstUnit).toBeInViewport();
  await firstUnit.selectOption('new');
  const name = firstRow.getByLabel('Name der Einheit');
  await name.scrollIntoViewIfNeeded();
  await expect(name).toBeInViewport();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
