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
  await expect(firstUnit).toBeFocused();
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
  const generatedExample = page
    .getByLabel('Beispielsatz', { exact: true })
    .nth(generatedExampleIndex);
  await expect(generatedExample).toHaveValue('This memory makes me smile.');
  const generatedTranslation = page
    .getByLabel('Deutsche Übersetzung des Beispielsatzes')
    .nth(generatedExampleIndex);
  await expect(generatedTranslation).toHaveValue(
    'Diese Erinnerung bringt mich zum Lächeln.',
  );
  await expect(generatedTranslation).toBeFocused();
  await expect(
    page.getByText(
      'Mit KI erzeugt. Prüfe Satz und Übersetzung vor dem Import.',
    ),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm shows a printed example with its translation and re-translates a rewrite', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  const rows = page.locator('form > ul > li');
  const first = rows.first();
  const translation = first.getByLabel(
    'Deutsche Übersetzung des Beispielsatzes',
  );
  const sentence = first.getByLabel('Beispielsatz', { exact: true });
  await expect(sentence).toHaveValue('The journey takes three hours.');
  await expect(translation).toHaveValue('Die Reise dauert drei Stunden.');
  await expect(
    first.getByText('Übersetzung mit KI erzeugt. Prüfe sie vor dem Import.'),
  ).toBeVisible();

  await sentence.fill('The journey takes two hours.');
  await expect(translation).toHaveValue('');
  await sentence.blur();
  await expect(translation).toHaveValue(
    'Übersetzt: The journey takes two hours.',
  );
  await translation.fill('Die Reise dauert zwei Stunden.');
  await expect(translation).toHaveValue('Die Reise dauert zwei Stunden.');
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm translates a rewrite blurred while an older request is pending', async ({
  page,
}) => {
  await page.goto('/?state=verification-deferred');
  const row = page.locator('form > ul > li').first();
  const sentence = row.getByLabel('Beispielsatz', { exact: true });
  const translation = row.getByLabel('Deutsche Übersetzung des Beispielsatzes');
  await sentence.fill('An older rewrite.');
  await sentence.blur();
  await expect(translation).toBeDisabled();
  await sentence.fill('The latest rewrite.');
  await sentence.blur();
  const latest = page.getByRole('button', {
    name: 'Resolve translation 2: The latest rewrite.',
    exact: true,
  });
  await expect(latest).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Resolve translation 1: An older rewrite.',
      exact: true,
    })
    .click();
  await expect(translation).toHaveValue('');
  await expect(translation).toBeDisabled();
  await latest.click();
  await expect(translation).toHaveValue('Übersetzt: The latest rewrite.');
  await expect(translation).toBeEnabled();
  await translation.fill('');
  await translation.blur();
  await expect(translation).toHaveValue('');
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm fills every missing example sentence with one click', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  await expect(page.getByText('2 Einträge ohne Beispielsatz')).toBeVisible();
  await page.getByRole('button', { name: 'Beispielsätze erzeugen' }).click();
  await expect(page.getByText('ohne Beispielsatz')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Beispielsatz erzeugen' }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel('Beispielsatz', { exact: true }).nth(generatedExampleIndex),
  ).toHaveValue('This memory makes me smile.');
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
