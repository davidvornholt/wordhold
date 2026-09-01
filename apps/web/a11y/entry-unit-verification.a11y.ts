import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

const generatedExampleIndex = 3;

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('VerifyForm defaults to the latest real unit and routes entries independently', async ({
  page,
}) => {
  await page.goto('/?state=verification-deferred');
  const rows = page.locator('form > ul > li');
  await rows
    .first()
    .getByRole('button', { name: 'Einheit für Eintrag 1 ändern' })
    .click();
  const firstUnit = rows.first().getByLabel('Einheit für Eintrag 1');
  await expect(firstUnit).toHaveValue('22222222-2222-4222-8222-222222222222');
  await firstUnit.selectOption('11111111-1111-4111-8111-111111111111');
  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
  await page.getByLabel('Englisch').last().fill('remember');
  await page.getByLabel('Deutsch').last().fill('sich erinnern');
  await rows
    .nth(1)
    .getByRole('button', { name: 'Einheit für Eintrag 2 ändern' })
    .click();
  await page
    .getByLabel('Einheit für Eintrag 2')
    .selectOption('22222222-2222-4222-8222-222222222222');
  await page.getByRole('button', { name: '2 Einträge importieren' }).click();

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
  const firstRow = page.locator('form > ul > li').first();
  await firstRow
    .getByRole('button', { name: 'Einheit für Eintrag 1 ändern' })
    .click();
  await firstRow.getByLabel('Einheit für Eintrag 1').selectOption('new');
  const name = page.getByLabel('Name der Einheit');
  const submit = page.getByRole('button', { name: '1 Eintrag importieren' });
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
  await page.getByRole('button', { name: '1 Eintrag importieren' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Diese Einheit gibt es nicht mehr. Lade die Seite neu.',
  );
  const changeUnit = page
    .locator('form > ul > li')
    .first()
    .getByRole('button', { name: 'Einheit für Eintrag 1 ändern' });
  await expect(changeUnit).toBeEnabled();
  await changeUnit.click();
  await expect(
    page.locator('form > ul > li').first().getByLabel('Einheit für Eintrag 1'),
  ).toBeEnabled();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm generates an editable sentence and German translation', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  const generate = page
    .getByRole('button', { name: 'Beispielsatz erzeugen' })
    .first();
  await generate.click();
  await expect(
    page.getByLabel('Beispielsatz').nth(generatedExampleIndex),
  ).toHaveValue('This memory makes me smile.');
  await expect(
    page.getByLabel('Deutsche Übersetzung des Beispielsatzes').first(),
  ).toHaveValue('Diese Erinnerung bringt mich zum Lächeln.');
  await expect(
    page.getByText(
      'Mit KI erzeugt. Prüfe Satz und Übersetzung vor dem Import.',
    ),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
