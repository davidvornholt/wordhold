import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';
import { verse } from './text-fixture-data';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const slippedCopy = verse.replace('geliebt', 'gelibt');

test('a new collection is named in a dialog and leads with its first text', async ({
  page,
}) => {
  await page.goto('/?state=dashboard');
  await page.getByRole('button', { name: 'Neue Sammlung' }).click();
  const dialog = page.getByRole('dialog', { name: 'Neue Sammlung' });
  const name = dialog.getByRole('textbox', { name: 'Name der Sammlung' });
  await expect(name).toBeFocused();
  await name.fill('Gedichte');
  await dialog.getByRole('button', { name: 'Sammlung anlegen' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'texts-course-empty',
  );
  await expect(page.getByText('Noch keine Texte')).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('a text keeps its lines and the next text follows', async ({ page }) => {
  await page.goto('/?state=texts-course-empty');
  await page.getByRole('button', { name: 'Text eintragen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Text eintragen' });
  const title = dialog.getByRole('textbox', { exact: true, name: 'Titel' });
  const text = dialog.getByRole('textbox', { exact: true, name: 'Text' });
  await expect(title).toBeFocused();
  await title.fill('Psalm 23,1');
  await text.fill('Der HERR ist mein Hirte;');
  // Enter starts a new line, since verses and poems keep theirs.
  await text.press('Enter');
  await text.pressSequentially('mir wird nichts mangeln.');
  await expect(text).toHaveValue(
    'Der HERR ist mein Hirte;\nmir wird nichts mangeln.',
  );
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await dialog.getByRole('button', { exact: true, name: 'Eintragen' }).click();
  await expect(
    dialog.getByRole('status', { name: 'Status beim Eintragen eines Texts' }),
  ).toHaveText('„Psalm 23,1“ eingetragen.');
  await expect(page.getByText('1 Text · 1 noch kennenlernen')).toBeVisible();
  await expect(title).toBeFocused();
  await title.fill('psalm 23,1');
  await expect(
    dialog.getByText('„psalm 23,1“ ist schon als „Psalm 23,1“ eingetragen.'),
  ).toBeVisible();

  await dialog.getByRole('button', { name: 'Fertig' }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Texte' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { exact: true, name: 'Psalm 23,1' }),
  ).toBeVisible();
});

test('a text recited with too many mistakes is copied word for word', async ({
  page,
}) => {
  await page.goto('/?state=texts-practice');
  await expect(page.getByText('Schreib den Text auswendig')).toBeVisible();
  const answer = page.getByLabel('Deine Antwort');
  await expect(answer).toBeFocused();
  await expect(answer).toHaveAttribute('placeholder', 'Dein Text');
  await answer.fill('Also hat Gott die Welt geliebt');
  await answer.press('Enter');

  await expect(page.getByText('Noch nicht sicher')).toBeVisible();
  await expect(
    page.getByText('21 Fehler bei 27 Wörtern. Erlaubt sind 2 Fehler.'),
  ).toBeVisible();
  await expect(page.locator('ins').first()).toHaveText('Fehlt: daß');
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  const retype = page.getByLabel('Schreib die Antwort ab');
  await expect(retype).toBeFocused();
  await retype.fill(slippedCopy);
  await retype.press('Enter');
  await expect(
    page.getByText(
      'Noch nicht ganz: Das 6. Wort ist „geliebt“, nicht „gelibt“.',
    ),
  ).toBeVisible();
  await expect(retype).toHaveValue(slippedCopy);

  await retype.fill(verse);
  await retype.press('Enter');
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'practice-empty',
  );
});

test('a nearly recited text marks each mistake in place', async ({ page }) => {
  await page.goto('/?state=texts-feedback');
  await expect(page.getByText('Fast richtig')).toBeVisible();
  await expect(
    page.getByText(
      '2 Fehler und 1 Tippfehler bei 27 Wörtern. Erlaubt sind 2 Fehler.',
    ),
  ).toBeVisible();
  await expect(page.locator('del')).toHaveText(['Geschrieben: gehen']);
  await expect(page.locator('ins')).toHaveText([
    'Richtig: werden',
    'Fehlt: ewige',
  ]);
  await expect(
    page.getByText('eingeborenen (vertippt als eingebornen)'),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('the learning pass shows a text to copy and keeps a slipped copy', async ({
  page,
}) => {
  await page.goto('/?state=texts-learn');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Johannes 3,16' }),
  ).toBeVisible();
  await expect(page.getByText('0 von 1 Text kennengelernt')).toBeVisible();
  const field = page.getByLabel('Schreib den Text ab');
  await expect(field).toBeFocused();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await field.fill(slippedCopy);
  await field.press('Enter');
  await expect(
    page.getByText(
      'Noch nicht ganz: Das 6. Wort ist „geliebt“, nicht „gelibt“.',
    ),
  ).toBeVisible();
  await expect(field).toHaveValue(slippedCopy);

  await field.fill(verse);
  await field.press('Enter');
  await expect(
    page.getByRole('heading', { name: '1 Text kennengelernt' }),
  ).toBeVisible();
});

test('the overview lists collections apart from subjects', async ({ page }) => {
  await page.goto('/?state=dashboard-subjects');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Sammlungen' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Neue Texte kennenlernen' }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await page.getByRole('button', { exact: true, name: 'Bibelverse' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'texts-course',
  );
  await expect(
    page.getByRole('button', { exact: true, name: 'Psalm 23,1–3' }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(
    page.getByText('Mit bis zu einem Fehler pro zehn Wörter zählt er noch'),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
