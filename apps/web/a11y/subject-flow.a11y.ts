import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// Playwright's Page type reaches this file only through the test fixtures.
type Page = Parameters<Parameters<typeof test>[2]>[0]['page'];

const termField = (page: Page) =>
  page.getByRole('textbox', { exact: true, name: 'Begriff' });
const definitionField = (page: Page) =>
  page.getByRole('textbox', { exact: true, name: 'Definition' });
const entryStatus = (page: Page) =>
  page.getByRole('status', { name: 'Status beim Eintragen eines Begriffs' });
const openEntryDialog = (page: Page) =>
  page.getByRole('button', { name: 'Begriff eintragen' }).click();
const suggestedDefinition =
  'Eine Reaktion, bei der ein Stoff Elektronen abgibt.';

test('a new subject is named in a dialog and leads with its first term', async ({
  page,
}) => {
  await page.goto('/?state=dashboard');
  const opener = page.getByRole('button', { name: 'Neues Fach' });
  await expect(opener).toHaveAttribute('aria-haspopup', 'dialog');
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Neues Fach' });
  const name = dialog.getByRole('textbox', { name: 'Name des Fachs' });
  const create = dialog.getByRole('button', { name: 'Fach anlegen' });
  await expect(name).toBeFocused();
  await expect(create).toBeDisabled();
  await name.fill('english a2');
  await create.click();
  await expect(dialog.getByRole('alert')).toHaveText(
    '„english a2“ gibt es auf der Übersicht bereits.',
  );
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await name.fill('Chemie');
  await create.click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'terms-course-empty',
  );
  await expect(page.getByText('Noch keine Begriffe')).toBeVisible();
  await expect(termField(page)).toHaveCount(0);
  await expect(
    page.getByRole('combobox', { name: 'Eintragen in' }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Neues Buch' })).toHaveCount(0);
  await expect(page.getByText('Für jetzt geschafft')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Seite fotografieren' }),
  ).toHaveCount(0);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await openEntryDialog(page);
  await expect(termField(page)).toBeFocused();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('a term takes a suggested definition and the next term follows', async ({
  page,
}) => {
  await page.goto('/?state=terms-course-empty');
  await openEntryDialog(page);
  const submit = page.getByRole('button', { exact: true, name: 'Eintragen' });
  await expect(
    page.getByRole('button', { name: 'Definition vorschlagen' }),
  ).toHaveCount(0);
  await termField(page).fill('Oxidation');
  await page.getByRole('button', { name: 'Definition vorschlagen' }).click();
  await expect(definitionField(page)).toHaveValue(suggestedDefinition);
  await expect(definitionField(page)).toBeFocused();
  await expect(
    page.getByText(
      'Definition mit KI vorgeschlagen. Prüfe sie vor dem Eintragen.',
    ),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await definitionField(page).press('Enter');
  await expect(entryStatus(page)).toHaveText('„Oxidation“ eingetragen.');
  await expect(page.getByText('1 Begriff · 1 noch kennenlernen')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Begriffe' }),
  ).toBeVisible();
  await expect(termField(page)).toBeFocused();
  await expect(termField(page)).toHaveValue('');
  await expect(definitionField(page)).toHaveValue('');

  await termField(page).fill('oxidation');
  await expect(
    page.getByText('„oxidation“ ist schon als „Oxidation“ eingetragen.'),
  ).toBeVisible();
  await termField(page).fill('Oxidation');
  await definitionField(page).fill('Abgabe von Elektronen.');
  await expect(
    page.getByText('„Oxidation“ ist schon eingetragen.'),
  ).toBeVisible();
  await expect(submit).toBeDisabled();

  await page
    .getByRole('dialog', { name: 'Begriff eintragen' })
    .getByRole('button', { name: 'Fertig' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Begriff eintragen' }),
  ).toBeFocused();
  await expect(
    page.getByRole('button', { exact: true, name: 'Oxidation' }),
  ).toBeVisible();
});

test('a definition is offered only while the field is empty', async ({
  page,
}) => {
  await page.goto('/?state=terms-course-empty');
  await openEntryDialog(page);
  await termField(page).fill('Reduktion');
  await definitionField(page).fill('Aufnahme von Elektronen.');
  await expect(
    page.getByRole('button', { name: 'Definition vorschlagen' }),
  ).toHaveCount(0);
});

test('key points are derived, corrected and checked before they are saved', async ({
  page,
}) => {
  await page.goto('/?state=terms-course');
  const open = page.getByRole('button', { exact: true, name: 'Enzym' });
  await expect(open).toHaveAttribute('aria-haspopup', 'dialog');
  await open.click();
  const enzym = page.getByRole('dialog', { name: 'Enzym' });
  await expect(enzym).toContainText('Begriff → Definition');
  await expect(
    enzym.getByText(
      'Ein Protein, das als Biokatalysator eine bestimmte Reaktion im Körper beschleunigt.',
    ),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await expect(
    enzym.getByText(
      'Noch keine Kernpunkte. Sie werden spätestens bei der ersten Abfrage bestimmt.',
    ),
  ).toBeVisible();
  await enzym.getByRole('button', { name: 'Kernpunkte bestimmen' }).click();
  const points = enzym.getByRole('list');
  await expect(points.getByRole('listitem')).toHaveText([
    'Ein Enzym ist ein Protein.',
    'Es wirkt als Biokatalysator.',
    'Es beschleunigt eine bestimmte Reaktion im Körper.',
  ]);
  await expect(enzym.getByText('Kernpunkte', { exact: true })).toBeVisible();

  await enzym.getByRole('button', { name: 'Kernpunkte bearbeiten' }).click();
  const editor = enzym.getByRole('textbox', {
    name: 'Kernpunkte, einer pro Zeile',
  });
  await expect(editor).toBeFocused();
  await editor.fill('  \n');
  await enzym.getByRole('button', { name: 'Speichern' }).click();
  await expect(enzym.getByRole('alert')).toHaveText(
    'Trag mindestens einen Kernpunkt ein.',
  );
  await editor.fill(
    'Ein Enzym ist ein Protein.\n\nEs beschleunigt eine Reaktion.\n',
  );
  await enzym.getByRole('button', { name: 'Speichern' }).click();
  await expect(points.getByRole('listitem')).toHaveText([
    'Ein Enzym ist ein Protein.',
    'Es beschleunigt eine Reaktion.',
  ]);
  await expect(
    enzym.getByRole('button', { name: 'Kernpunkte bearbeiten' }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await enzym.getByRole('button', { name: 'Schließen' }).click();
  await expect(enzym).toBeHidden();
  await expect(open).toBeFocused();
  await open.click();
  await expect(points.getByRole('listitem')).toHaveText([
    'Ein Enzym ist ein Protein.',
    'Es beschleunigt eine Reaktion.',
  ]);
});

test('a subject is renamed from its settings, apart from the other courses', async ({
  page,
}) => {
  await page.goto('/?state=terms-settings');
  await expect(
    page.getByRole('group', { name: 'Regelmäßige Abfragerichtungen' }),
  ).toHaveCount(0);
  const name = page.getByRole('textbox', { name: 'Name des Fachs' });
  const rename = page.getByRole('button', { name: 'Umbenennen' });
  const status = page.getByRole('status', {
    name: 'Status beim Umbenennen des Fachs',
  });
  await expect(name).toHaveValue('Chemie');
  await name.fill('English A2');
  await rename.click();
  await expect(status).toHaveText(
    '„English A2“ gibt es auf der Übersicht bereits.',
  );
  await name.fill('Allgemeine Chemie');
  await rename.click();
  await expect(status).toHaveText('Umbenannt in Allgemeine Chemie.');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Allgemeine Chemie: Einstellungen',
    }),
  ).toBeVisible();
});

test('the overview lists a subject with its failed terms by name only', async ({
  page,
}) => {
  await page.goto('/?state=dashboard-subjects');
  await expect(page.getByRole('button', { name: 'Neues Fach' })).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Name des Fachs' }),
  ).toHaveCount(0);
  const fragile = page.getByRole('list').filter({ hasText: 'Katalysator' });
  await expect(fragile.getByRole('listitem')).toHaveCount(2);
  await expect(fragile.getByText('Aktivierungsenergie')).toHaveCount(0);
  // One sitting per course, each naming its course and count.
  await expect(
    page.getByRole('button', { name: 'English A2 üben · 1 Vokabel' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Chemie üben · 1 Begriff' }),
  ).toBeVisible();
  await page.getByRole('button', { exact: true, name: 'Chemie' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'terms-course',
  );
  await expect(
    page.getByRole('heading', { level: 2, name: 'Begriffe' }),
  ).toBeVisible();
});
