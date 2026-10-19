import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// Playwright's Page type reaches this file only through the test fixtures.
type Page = Parameters<Parameters<typeof test>[2]>[0]['page'];

const termFields = (page: Page) =>
  page.getByRole('textbox', { exact: true, name: 'Begriff' });
const definitionFields = (page: Page) =>
  page.getByRole('textbox', { exact: true, name: 'Erklärung' });
const submitButton = (page: Page, label: string) =>
  page.getByRole('button', { exact: true, name: label });

test('photographed notes are checked flag by flag before they are saved', async ({
  page,
}) => {
  await page.goto('/?state=terms-review');
  await expect(
    page.getByRole('img', { name: 'Fotografierte Notizen' }),
  ).toBeVisible();
  await expect(termFields(page)).toHaveCount(11);
  await expect(page.getByText('Schon im Fach.')).toBeVisible();
  await expect(
    page.getByText('1 Begriff ist schon eingetragen und wird übersprungen.'),
  ).toBeVisible();
  const save = submitButton(page, '10 Begriffe eintragen');
  await expect(save).toBeEnabled();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await page
    .getByRole('button', { name: '1 unsicher gelesen – zum nächsten springen' })
    .click();
  const misread = termFields(page).last();
  await expect(misread).toBeFocused();
  await expect(misread).toHaveValue('Trindecan');
  await misread.fill('Tridecan');
  await page
    .getByRole('button', { name: '1 schon vorhanden – zum nächsten springen' })
    .click();
  await expect(termFields(page).nth(2)).toBeFocused();
  await expect(termFields(page).nth(2)).toHaveValue('Methan');

  await misread.press('Control+Enter');
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'terms-course',
  );
});

test('a removed term returns on undo and a half-filled row holds the save back', async ({
  page,
}) => {
  await page.goto('/?state=terms-review');
  await page.getByRole('button', { name: 'Begriff 1 entfernen' }).click();
  await expect(page.getByText('„Alkan“ entfernt.').first()).toBeVisible();
  await expect(submitButton(page, '9 Begriffe eintragen')).toBeEnabled();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(termFields(page).first()).toHaveValue('Alkan');
  await expect(termFields(page).first()).toBeFocused();

  await page.getByRole('button', { name: 'Begriff hinzufügen' }).click();
  const added = termFields(page).last();
  await expect(added).toBeFocused();
  await added.fill('Nonan');
  await added.press('Shift+Tab');
  await expect(
    page.getByText('Die Erklärung fehlt. Ergänze sie oder entferne die Zeile.'),
  ).toBeVisible();
  await expect(
    page.getByText('Ergänze oder entferne die unvollständige Zeile.'),
  ).toBeVisible();
  await expect(submitButton(page, '11 Begriffe eintragen')).toHaveCount(0);
  await expect(submitButton(page, '10 Begriffe eintragen')).toBeDisabled();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await page
    .getByRole('button', { name: '1 unvollständig – zum nächsten springen' })
    .click();
  const definition = definitionFields(page).last();
  await expect(definition).toBeFocused();
  await definition.fill('C₉H₂₀');
  await expect(submitButton(page, '11 Begriffe eintragen')).toBeEnabled();
  await expect(
    page.getByRole('button', {
      name: '1 unvollständig – zum nächsten springen',
    }),
  ).toHaveCount(0);
});
