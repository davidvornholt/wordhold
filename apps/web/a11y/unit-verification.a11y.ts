import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const unitTwoId = '11111111-1111-4111-8111-111111111111';
const unitThreeId = '22222222-2222-4222-8222-222222222222';
const boundaryIndex = 6;

test('VerifyForm assigns one unit to every entry or from one entry onward', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  const rows = page.locator('form > ul > li');
  const unitPickers = rows.locator('select');

  await page.getByLabel('Einheit für alle Vokabeln').selectOption(unitTwoId);
  await page.getByRole('button', { name: 'Auf alle anwenden' }).click();
  const initialEntryCount = await rows.count();
  await expect(unitPickers).toHaveCount(initialEntryCount);
  expect(
    await unitPickers.evaluateAll((pickers) =>
      pickers.map((picker) => (picker as HTMLSelectElement).value),
    ),
  ).toEqual(Array.from({ length: initialEntryCount }, () => unitTwoId));

  const boundaryPosition = boundaryIndex + 1;
  await page
    .getByLabel(`Einheit für Eintrag ${boundaryPosition}`)
    .selectOption(unitThreeId);
  await page
    .getByRole('button', {
      name: `Einheit ab Vokabel ${boundaryPosition} anwenden`,
    })
    .click();

  expect(
    await unitPickers.evaluateAll((pickers) =>
      pickers.map((picker) => (picker as HTMLSelectElement).value),
    ),
  ).toEqual(
    Array.from({ length: initialEntryCount }, (_, index) =>
      index < boundaryIndex ? unitTwoId : unitThreeId,
    ),
  );

  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
  await expect(
    page.getByLabel(`Einheit für Eintrag ${(await rows.count()).toString()}`),
  ).toHaveValue(unitThreeId);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm applies a named new unit to every entry', async ({ page }) => {
  await page.goto('/?state=verification');
  const bulkAssignment = page.getByRole('group', {
    name: 'Mehrere Vokabeln zuordnen',
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
  expect(
    await rows
      .getByLabel('Name der Einheit')
      .evaluateAll((names) =>
        names.map((name) => (name as HTMLInputElement).value),
      ),
  ).toEqual(Array.from({ length: await rows.count() }, () => 'Unit 4'));
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm defaults to the latest real unit and routes entries independently', async ({
  page,
}) => {
  await page.goto('/?state=verification-deferred');
  const firstUnit = page
    .locator('form > ul > li')
    .first()
    .getByLabel('Einheit für Eintrag 1');
  await expect(firstUnit).toHaveValue('22222222-2222-4222-8222-222222222222');
  await firstUnit.selectOption('11111111-1111-4111-8111-111111111111');
  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
  await page.getByLabel('Englisch').last().fill('remember');
  await page.getByLabel('Deutsch').last().fill('sich erinnern');
  await page
    .getByLabel('Einheit für Eintrag 2')
    .selectOption('22222222-2222-4222-8222-222222222222');
  await page.getByLabel('Seitenbezeichnung').press('Enter');

  await expect(page.getByLabel('Verification calls')).toHaveText('1');
  await expect(page.getByLabel('Verification snapshot')).toContainText(
    '11111111-1111-4111-8111-111111111111',
  );
  await expect(page.getByLabel('Verification snapshot')).toContainText(
    '22222222-2222-4222-8222-222222222222',
  );
});

test('VerifyForm requires a name when switching to a new unit', async ({
  page,
}) => {
  await page.goto('/?state=verification-deferred');
  await page
    .locator('form > ul > li')
    .first()
    .getByLabel('Einheit für Eintrag 1')
    .selectOption('new');
  const name = page.getByLabel('Name der Einheit');
  const submit = page.getByRole('button', { name: '1 Einträge importieren' });
  await expect(name).toHaveAttribute('required', '');
  await expect(submit).toBeDisabled();
  await name.fill('Unit 4');
  await expect(submit).toBeEnabled();
  await name.press('Enter');
  await expect(page.getByLabel('Verification calls')).toHaveText('1');
  await expect(page.getByLabel('Verification snapshot')).toContainText(
    '"name":"Unit 4"',
  );
});

test('VerifyForm starts with a required new-unit name when a course has no units', async ({
  page,
}) => {
  await page.goto('/?state=verification-no-units');
  await expect(
    page.locator('form > ul > li').first().getByLabel('Einheit für Eintrag 1'),
  ).toHaveValue('new');
  const name = page
    .locator('form > ul > li')
    .first()
    .getByLabel('Name der Einheit');
  await expect(name).toBeVisible();
  await expect(
    page.getByRole('button', { name: '12 Einträge importieren' }),
  ).toBeDisabled();
  await name.press('Enter');
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'verification-no-units',
  );
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm announces a stale unit failure and unlocks recovery', async ({
  page,
}) => {
  await page.goto('/?state=verification-stale-unit');
  await page.getByRole('button', { name: '1 Einträge importieren' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Diese Einheit gibt es nicht mehr. Lade die Seite neu.',
  );
  await expect(
    page.locator('form > ul > li').first().getByLabel('Einheit für Eintrag 1'),
  ).toBeEnabled();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm remains usable in its existing and new-unit mobile states', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/?state=verification');
  await expect(
    page.getByRole('group', { name: 'Mehrere Vokabeln zuordnen' }),
  ).toBeInViewport();
  const firstRow = page.locator('form > ul > li').first();
  const firstUnit = firstRow.getByLabel('Einheit für Eintrag 1');
  await firstUnit.scrollIntoViewIfNeeded();
  await expect(firstUnit).toBeInViewport();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await firstUnit.selectOption('new');
  const name = firstRow.getByLabel('Name der Einheit');
  await name.scrollIntoViewIfNeeded();
  await expect(name).toBeInViewport();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
