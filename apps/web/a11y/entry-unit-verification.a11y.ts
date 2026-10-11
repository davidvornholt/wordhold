import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

const generatedExampleIndex = 3;
const unitTwoId = '11111111-1111-4111-8111-111111111111';
const unitThreeId = '22222222-2222-4222-8222-222222222222';
const generatedHint = 'Mit KI erzeugt. Prüfe den Satz vor dem Import.';
const translatedHint =
  'Mit KI übersetzt. Prüfe die Übersetzung vor dem Import.';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('VerifyForm defaults to the latest real unit and files later entries into another', async ({
  page,
}) => {
  await page.goto('/?state=verification-deferred');
  const unit = page.getByLabel('Einheit', { exact: true });
  await expect(unit).toHaveValue(unitThreeId);
  await unit.selectOption(unitTwoId);
  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
  await expect(page.getByLabel('Englisch').last()).toBeFocused();
  await page.getByLabel('Englisch').last().fill('remember');
  await page
    .getByLabel('Deutsch', { exact: true })
    .last()
    .fill('sich erinnern');
  await page
    .getByRole('button', { name: 'Andere Einheit ab Eintrag 2' })
    .click();
  // The page moves on from Unit 2 to the book's next unit.
  await expect(
    page.getByLabel('Einheit ab Eintrag 2', { exact: true }),
  ).toHaveValue(unitThreeId);
  await page.getByRole('button', { name: '2 Einträge importieren' }).click();

  await expect(page.getByLabel('Verification calls')).toHaveText('1');
  const snapshot = page.getByLabel('Verification snapshot');
  await expect(snapshot).toContainText(unitTwoId);
  await expect(snapshot).toContainText(unitThreeId);
});

test('VerifyForm never proposes the holding unit as the next unit', async ({
  page,
}) => {
  await page.goto('/?state=verification-deferred');
  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
  await page
    .getByRole('button', { name: 'Andere Einheit ab Eintrag 2' })
    .click();
  // Unit 3 is the book's last real unit; only "Ohne Einheit" follows it.
  await expect(
    page.getByLabel('Einheit ab Eintrag 2', { exact: true }),
  ).toHaveValue('new');
});

test('VerifyForm requires a name for a new unit and imports only on Ctrl+Enter', async ({
  page,
}) => {
  await page.goto('/?state=verification-deferred');
  await page.getByLabel('Einheit', { exact: true }).selectOption('new');
  const name = page.getByLabel('Name der Einheit');
  const submit = page.getByRole('button', { name: '1 Eintrag importieren' });
  await expect(name).toHaveAttribute('required', '');
  await expect(submit).toBeDisabled();
  await name.fill('Unit 4');
  await expect(submit).toBeEnabled();
  await expect(submit).toHaveAttribute(
    'aria-keyshortcuts',
    'Control+Enter Meta+Enter',
  );
  await name.press('Enter');
  await expect(page.getByLabel('Verification calls')).toHaveText('0');
  await name.press('Control+Enter');
  await expect(page.getByLabel('Verification calls')).toHaveText('1');
  await expect(page.getByLabel('Verification snapshot')).toContainText(
    '"name":"Unit 4"',
  );
});

test('VerifyForm files the first page of a course directly into its new book', async ({
  page,
}) => {
  await page.goto('/?state=verification-no-units');
  await page.getByLabel('Name des Buchs').fill('The Hobbit');
  await expect(page.getByLabel('Einheit', { exact: true })).toHaveValue('none');
  await expect(page.getByLabel('Name der Einheit')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '12 Einträge importieren' }),
  ).toBeEnabled();
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
  await expect(page.getByLabel('Einheit', { exact: true })).toBeEnabled();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm generates an editable sentence and German translation', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  const row = page.locator('form li[data-row-id]').nth(generatedExampleIndex);
  await row.getByRole('button', { name: 'Beispielsatz erzeugen' }).click();
  const sentence = row.getByLabel('Beispielsatz', { exact: true });
  await expect(sentence).toHaveValue('This memory makes me smile.');
  await expect(sentence).toHaveAccessibleDescription(generatedHint);
  const translation = row.getByLabel('Deutsche Übersetzung des Beispielsatzes');
  await expect(translation).toHaveValue(
    'Diese Erinnerung bringt mich zum Lächeln.',
  );
  await expect(translation).toHaveAccessibleDescription(translatedHint);
  await expect(translation).toBeFocused();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('VerifyForm marks a machine translation of a printed example and re-translates a rewrite', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  const first = page.locator('form li[data-row-id]').first();
  const translation = first.getByLabel(
    'Deutsche Übersetzung des Beispielsatzes',
  );
  const sentence = first.getByLabel('Beispielsatz', { exact: true });
  await expect(sentence).toHaveValue('The journey takes three hours.');
  await expect(sentence).toHaveAccessibleDescription('');
  await expect(translation).toHaveValue('Die Reise dauert drei Stunden.');
  await expect(translation).toHaveAccessibleDescription(translatedHint);

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
  const row = page.locator('form li[data-row-id]').first();
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
  const checklist = page.getByRole('region', { name: 'Vor dem Import' });
  await expect(
    checklist.getByText('2 Einträge ohne Beispielsatz'),
  ).toBeVisible();
  await checklist
    .getByRole('button', { name: 'Beispielsätze erzeugen' })
    .click();
  // The status line takes over from the button, so focus stays in place.
  const status = checklist.getByText('2 Beispielsätze erzeugt.');
  await expect(status).toBeVisible();
  await expect(status).toBeFocused();
  await expect(page.getByText('ohne Beispielsatz')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Beispielsatz erzeugen' }),
  ).toHaveCount(0);
  await expect(
    page
      .locator('form li[data-row-id]')
      .nth(generatedExampleIndex)
      .getByLabel('Beispielsatz', { exact: true }),
  ).toHaveValue('This memory makes me smile.');
  // Focusing a filled row would scroll the page to it as each sentence lands.
  await expect(page.locator('input:focus, textarea:focus')).toHaveCount(0);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
