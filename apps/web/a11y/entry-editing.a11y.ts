import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// Playwright's Page type reaches this file only through the test fixtures.
type Page = Parameters<Parameters<typeof test>[2]>[0]['page'];

// Exact names: the direction progress bars are also labelled with "Englisch".
const targetField = (page: Page) =>
  page.getByRole('textbox', { exact: true, name: 'Englisch' });
const nativeField = (page: Page) =>
  page.getByRole('textbox', { exact: true, name: 'Deutsch' });
const notice = (page: Page) =>
  page.getByRole('status', { name: 'Status beim Bearbeiten' });
const termCount = /^\d+ Begriffe/u;
const openEntry = async (page: Page, name: string) => {
  await page.getByRole('button', { exact: true, name }).click();
  return page.getByRole('dialog', { name });
};

test('a word is corrected from its details and keeps its row', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary');
  let dialog = await openEntry(page, 'the referee');
  const edit = dialog.getByRole('button', { exact: true, name: 'Bearbeiten' });
  await edit.click();
  await expect(targetField(page)).toBeFocused();
  await expect(targetField(page)).toHaveValue('the referee');
  await expect(nativeField(page)).toHaveValue('der Schiedsrichter');
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(edit).toBeFocused();
  await expect(notice(page)).toHaveText('');

  await edit.click();
  await targetField(page).fill('memory');
  await expect(
    dialog.getByText(
      '„memory“ ist schon in Green Line 3 · Unit 3: Holidays, mit anderer Schreibweise oder anderem Beispielsatz.',
    ),
  ).toBeVisible();
  await targetField(page).fill('the umpire');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  dialog = page.getByRole('dialog', { name: 'the umpire' });
  await expect(notice(page)).toHaveText('„the umpire“ gespeichert.');
  await expect(
    dialog.getByRole('button', { exact: true, name: 'Bearbeiten' }),
  ).toBeFocused();
  await expect(dialog.getByText('der Schiedsrichter')).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('button', { exact: true, name: 'the umpire' }),
  ).toBeFocused();
});

test('a stored example needs no review until it is rewritten', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary');
  const dialog = await openEntry(page, 'memory');
  await dialog.getByRole('button', { exact: true, name: 'Bearbeiten' }).click();
  const sentence = dialog.getByRole('textbox', {
    exact: true,
    name: 'Beispielsatz (optional)',
  });
  const translation = dialog.getByRole('textbox', {
    name: 'Deutsche Übersetzung des Beispielsatzes',
  });
  await expect(sentence).toHaveValue('That trip is a happy memory.');
  await expect(translation).toHaveValue(
    'Diese Reise ist eine schöne Erinnerung.',
  );
  await expect(dialog.getByText('Übersetzung mit KI erzeugt')).toHaveCount(0);

  await sentence.fill('We packed our bags for the trip.');
  await expect(translation).toHaveValue('');
  await sentence.blur();
  await expect(translation).toHaveValue(
    'Wir packten unsere Koffer für die Reise.',
  );
  await expect(
    dialog.getByText(
      'Übersetzung mit KI erzeugt. Prüfe sie vor dem Speichern.',
    ),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(notice(page)).toHaveText('„memory“ gespeichert.');
  await expect(
    dialog.getByText('We packed our bags for the trip.'),
  ).toBeVisible();
});

test('a deleted word leaves the list and its selection', async ({ page }) => {
  await page.goto('/?state=vocabulary');
  await page.getByLabel('memory auswählen').check();
  await page.getByLabel('the referee auswählen').check();
  await expect(page.getByText('2 Vokabeln ausgewählt')).toBeVisible();

  const dialog = await openEntry(page, 'memory');
  const remove = dialog.getByRole('button', { name: 'Löschen' });
  await remove.click();
  const confirm = dialog.getByRole('button', { name: 'Endgültig löschen' });
  await expect(confirm).toBeFocused();
  await expect(
    dialog.getByText(
      'Löschen entfernt auch den Lernstand und alle bisherigen Antworten.',
      { exact: false },
    ),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await dialog.getByRole('button', { name: 'Behalten' }).click();
  await expect(remove).toBeFocused();
  await remove.click();
  await confirm.click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText('Termine gelten pro Abfragerichtung.', { exact: false }),
  ).toBeFocused();
  await expect(
    page.getByRole('button', { exact: true, name: 'memory' }),
  ).toHaveCount(0);
  await expect(page.getByText('1 Vokabel ausgewählt')).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('deleting the last word of a unit hands focus to its heading', async ({
  page,
}) => {
  await page.goto('/?state=unit-due');
  const dialog = await openEntry(page, 'memory');
  await dialog.getByRole('button', { name: 'Löschen' }).click();
  await dialog.getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(dialog).toBeHidden();
  const heading = page.getByRole('heading', {
    level: 2,
    name: 'Vokabeln hinzufügen',
  });
  await expect(heading).toBeFocused();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('a term with a new definition loses its key points', async ({ page }) => {
  await page.goto('/?state=terms-course');
  const dialog = await openEntry(page, 'Katalysator');
  const keyPoint = dialog.getByText(
    'Er wird bei der Reaktion nicht verbraucht.',
  );
  await expect(keyPoint).toBeVisible();
  await dialog.getByRole('button', { exact: true, name: 'Bearbeiten' }).click();
  const term = dialog.getByRole('textbox', { exact: true, name: 'Begriff' });
  const definition = dialog.getByRole('textbox', {
    exact: true,
    name: 'Definition',
  });
  await expect(term).toBeFocused();
  await term.fill('Enzym');
  await expect(
    dialog.getByText('„Enzym“ ist schon eingetragen.'),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Speichern' }),
  ).toBeDisabled();
  await term.fill('Katalysator');
  await expect(
    dialog.getByText(
      'Mit der neuen Definition werden die Kernpunkte neu abgeleitet.',
    ),
  ).toHaveCount(0);
  await definition.fill('Ein Stoff, der eine Reaktion beschleunigt.');
  await expect(
    dialog.getByText(
      'Mit der neuen Definition werden die Kernpunkte neu abgeleitet.',
    ),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await definition.press('Enter');
  await expect(notice(page)).toHaveText('„Katalysator“ gespeichert.');
  await expect(
    dialog.getByText('Ein Stoff, der eine Reaktion beschleunigt.'),
  ).toBeVisible();
  await expect(keyPoint).toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: 'Kernpunkte bestimmen' }),
  ).toBeVisible();
});

test('a deleted term hands focus to the count of those left', async ({
  page,
}) => {
  await page.goto('/?state=terms-course');
  const summary = page.getByText(termCount);
  const before = await summary.textContent();
  const dialog = await openEntry(page, 'Enzym');
  await dialog.getByRole('button', { name: 'Löschen' }).click();
  await dialog.getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(dialog).toBeHidden();
  await expect(summary).toBeFocused();
  await expect(summary).not.toHaveText(before ?? '');
  await expect(
    page.getByRole('button', { exact: true, name: 'Enzym' }),
  ).toHaveCount(0);
});
