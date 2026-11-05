import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// Playwright's Page type reaches this file only through the test fixtures.
type Page = Parameters<Parameters<typeof test>[2]>[0]['page'];

const moveButton = (page: Page) =>
  page.getByRole('button', { name: 'Auswahl verschieben' });
const deleteButton = (page: Page) =>
  page.getByRole('button', { name: 'Auswahl löschen' });
const notice = (page: Page) =>
  page.getByRole('status', { name: 'Status der Auswahl' });
const intro = (page: Page) =>
  page.getByText('Termine gelten pro Abfragerichtung.', { exact: false });
const entryRow = (page: Page, name: string) =>
  page.getByRole('button', { exact: true, name });
const select = (page: Page, name: string) =>
  page.getByLabel(`${name} auswählen`).check();
const target = 'Green Line 2 · Unit 2 – School';
const anyValue = /.+/u;

test('a selection moves to another unit and keeps its words', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary');
  await select(page, 'memory');
  await select(page, 'the referee');
  await moveButton(page).click();
  const dialog = page.getByRole('dialog', { name: '2 Vokabeln verschieben' });
  const place = dialog.getByLabel('Verschieben nach');
  await expect(place).toBeFocused();
  await expect(
    dialog.getByText('Lernstand, Termine und bisherige Antworten'),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { exact: true, name: 'Verschieben' }),
  ).toBeDisabled();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await place.selectOption({ label: target });
  await dialog
    .getByRole('button', { exact: true, name: 'Verschieben' })
    .click();
  await expect(dialog).toBeHidden();
  await expect(notice(page)).toHaveText(
    `2 Vokabeln nach „${target}“ verschoben.`,
  );
  await expect(intro(page)).toBeFocused();
  await expect(moveButton(page)).toBeHidden();
  await expect(page.getByRole('checkbox', { name: target })).toBeVisible();
  await expect(entryRow(page, 'memory')).toBeVisible();
  await expect(entryRow(page, 'the referee')).toBeVisible();
  await expect(page.getByLabel('memory auswählen')).not.toBeChecked();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('a selection is deleted only after a warning that names its size', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary');
  await select(page, 'memory');
  await select(page, 'the referee');
  await deleteButton(page).click();
  const dialog = page.getByRole('dialog', { name: '2 Vokabeln löschen?' });
  await expect(
    dialog.getByText('Löschen entfernt auch den Lernstand', { exact: false }),
  ).toBeVisible();
  const confirm = dialog.getByRole('button', { name: 'Endgültig löschen' });
  await expect(confirm).toBeFocused();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await dialog.getByRole('button', { name: 'Behalten' }).click();
  await expect(dialog).toBeHidden();
  await expect(deleteButton(page)).toBeFocused();
  await expect(entryRow(page, 'memory')).toBeVisible();
  await deleteButton(page).click();
  await confirm.click();
  await expect(dialog).toBeHidden();
  await expect(notice(page)).toHaveText('2 Vokabeln gelöscht.');
  await expect(intro(page)).toBeFocused();
  await expect(entryRow(page, 'memory')).toHaveCount(0);
  await expect(entryRow(page, 'the referee')).toHaveCount(0);
  await expect(deleteButton(page)).toBeHidden();
});

test('moving the last word of a unit hands focus to its heading and keeps the notice', async ({
  page,
}) => {
  await page.goto('/?state=unit-due');
  await select(page, 'memory');
  await moveButton(page).click();
  const dialog = page.getByRole('dialog', { name: '1 Vokabel verschieben' });
  await dialog.getByLabel('Verschieben nach').selectOption({ label: target });
  await dialog
    .getByRole('button', { exact: true, name: 'Verschieben' })
    .click();
  await expect(dialog).toBeHidden();
  await expect(notice(page)).toHaveText(
    `1 Vokabel nach „${target}“ verschoben.`,
  );
  await expect(
    page.getByRole('heading', { level: 2, name: 'Vokabeln hinzufügen' }),
  ).toBeFocused();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('a move that fails keeps the dialog, the selection and the choice', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary&selectionResponse=failure');
  await select(page, 'memory');
  await moveButton(page).click();
  const dialog = page.getByRole('dialog', { name: '1 Vokabel verschieben' });
  const place = dialog.getByLabel('Verschieben nach');
  await place.selectOption({ label: target });
  await dialog
    .getByRole('button', { exact: true, name: 'Verschieben' })
    .click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Diese Einheit gibt es nicht mehr. Lade die Seite neu.',
  );
  await expect(place).toBeFocused();
  await expect(place).toHaveValue(anyValue);
  await expect(notice(page)).toBeEmpty();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(moveButton(page)).toBeFocused();
  await expect(page.getByLabel('memory auswählen')).toBeChecked();
});

test('a deletion that fails keeps the dialog and the selection', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary&selectionResponse=failure');
  await select(page, 'memory');
  await deleteButton(page).click();
  const dialog = page.getByRole('dialog', { name: '1 Vokabel löschen?' });
  const confirm = dialog.getByRole('button', { name: 'Endgültig löschen' });
  await confirm.click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Das Löschen hat nicht geklappt. Versuche es noch einmal.',
  );
  await expect(confirm).toBeFocused();
  await dialog.getByRole('button', { name: 'Behalten' }).click();
  await expect(page.getByLabel('memory auswählen')).toBeChecked();
});

test('a new change clears the notice of the last one', async ({ page }) => {
  await page.goto('/?state=vocabulary');
  await select(page, 'memory');
  await deleteButton(page).click();
  await page
    .getByRole('dialog', { name: '1 Vokabel löschen?' })
    .getByRole('button', { name: 'Endgültig löschen' })
    .click();
  await expect(notice(page)).toHaveText('1 Vokabel gelöscht.');
  await select(page, 'the referee');
  await deleteButton(page).click();
  await expect(notice(page)).toBeEmpty();
});

test('the place filter falls back to everything once its place is empty', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary');
  const filter = page.getByRole('combobox', { name: 'Buch oder Einheit' });
  await filter.selectOption({ label: 'Green Line 3 · Unit 4: Sport' });
  await expect(entryRow(page, 'memory')).toHaveCount(0);
  await select(page, 'the referee');
  await deleteButton(page).click();
  await page
    .getByRole('dialog', { name: '1 Vokabel löschen?' })
    .getByRole('button', { name: 'Endgültig löschen' })
    .click();
  await expect(notice(page)).toHaveText('1 Vokabel gelöscht.');
  await expect(filter).toHaveValue('all');
  await expect(entryRow(page, 'memory')).toBeVisible();
});

test('a subject is one list, so a selection can only be deleted', async ({
  page,
}) => {
  await page.goto('/?state=terms-course');
  await select(page, 'Katalysator');
  await expect(deleteButton(page)).toBeVisible();
  await expect(moveButton(page)).toHaveCount(0);
  await deleteButton(page).click();
  await page
    .getByRole('dialog', { name: '1 Begriff löschen?' })
    .getByRole('button', { name: 'Endgültig löschen' })
    .click();
  await expect(notice(page)).toHaveText('1 Begriff gelöscht.');
  await expect(entryRow(page, 'Katalysator')).toHaveCount(0);
});
