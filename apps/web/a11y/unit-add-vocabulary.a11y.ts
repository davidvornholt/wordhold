import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// Playwright's Page type reaches this file only through the test fixtures.
type Page = Parameters<Parameters<typeof test>[2]>[0]['page'];

const status = (page: Page) =>
  page.getByRole('status', { name: 'Status beim Eintragen einer Vokabel' });
// Exact names: the direction progress bars are also labelled with "Englisch".
const targetField = (page: Page) =>
  page.getByRole('textbox', { exact: true, name: 'Englisch' });
const nativeField = (page: Page) =>
  page.getByRole('textbox', { exact: true, name: 'Deutsch' });
const entryDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Vokabeln eintragen' });
// A filed row shows the word, then its translation.
const filedJourney = /journey.*die Reise/u;
const filedIsland = /island.*die Insel/u;
const filedEntries = (page: Page, heading: string) =>
  entryDialog(page)
    .getByRole('region', { name: heading })
    .getByRole('listitem');

test('a unit takes typed vocabulary one word after another', async ({
  page,
}) => {
  await page.goto('/?state=unit');
  await expect(targetField(page)).toHaveCount(0);
  const opener = page.getByRole('button', { name: 'Vokabel eintragen' });
  await expect(opener).toHaveAttribute('aria-haspopup', 'dialog');
  await opener.click();
  const target = targetField(page);
  await expect(target).toBeFocused();
  // The dialog covers the unit's page, so it names where the words go.
  await expect(entryDialog(page)).toHaveAccessibleDescription(
    'Eintragen in Green Line 3 · Unit 3 – Holidays',
  );
  const submit = page.getByRole('button', { exact: true, name: 'Eintragen' });
  await expect(submit).toBeDisabled();

  await target.fill('journey');
  await nativeField(page).fill('die Reise');
  await expect(submit).toBeEnabled();
  await nativeField(page).press('Enter');
  await expect(status(page)).toHaveText('„journey“ eingetragen.');
  await expect(target).toBeFocused();
  await expect(target).toHaveValue('');
  await expect(nativeField(page)).toHaveValue('');
  await expect(page.getByLabel('journey auswählen')).toBeVisible();
  // The word lands in the unit behind the dialog and under the card.
  await expect(
    page
      .getByRole('listitem')
      .filter({ has: page.getByLabel('journey auswählen') }),
  ).toContainText('die Reise');
  await expect(filedEntries(page, '1 Vokabel eingetragen')).toHaveText([
    filedJourney,
  ]);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  // Enter on the one side written moves to the other.
  await target.fill('island');
  await target.press('Enter');
  await expect(nativeField(page)).toBeFocused();
  await nativeField(page).fill('die Insel');
  await nativeField(page).press('Enter');
  await expect(status(page)).toHaveText('„island“ eingetragen.');
  await expect(filedEntries(page, '2 Vokabeln eingetragen')).toHaveText([
    filedIsland,
    filedJourney,
  ]);

  await entryDialog(page).getByRole('button', { name: 'Schließen' }).click();
  await expect(entryDialog(page)).toBeHidden();
  await expect(targetField(page)).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('"Schließen" never files: a complete word is held until it is filed', async ({
  page,
}) => {
  await page.goto('/?state=unit');
  const opener = page.getByRole('button', { name: 'Vokabel eintragen' });
  await opener.click();
  const close = entryDialog(page).getByRole('button', { name: 'Schließen' });
  await targetField(page).fill('journey');
  await nativeField(page).fill('die Reise');
  await close.click();
  await expect(entryDialog(page)).toBeVisible();
  await expect(status(page)).toHaveText(
    'Diese Vokabel ist noch nicht eingetragen.',
  );
  await expect(
    page.getByRole('button', { exact: true, name: 'Eintragen' }),
  ).toBeFocused();
  await expect(page.getByLabel('journey auswählen')).toHaveCount(0);

  await page.keyboard.press('Enter');
  await expect(status(page)).toHaveText('„journey“ eingetragen.');
  await expect(page.getByLabel('journey auswählen')).toBeVisible();
  await close.click();
  await expect(entryDialog(page)).toBeHidden();
  await expect(opener).toBeFocused();
});

test('"Schließen" holds a half-typed word until it is completed or discarded', async ({
  page,
}) => {
  await page.goto('/?state=unit');
  const opener = page.getByRole('button', { name: 'Vokabel eintragen' });
  await opener.click();
  const close = entryDialog(page).getByRole('button', { name: 'Schließen' });
  const discard = entryDialog(page).getByRole('button', { name: 'Verwerfen' });
  await targetField(page).fill('journey');
  await close.click();
  await expect(entryDialog(page)).toBeVisible();
  await expect(status(page)).toHaveText(
    'Diese Vokabel ist noch nicht eingetragen.',
  );
  await expect(nativeField(page)).toBeFocused();
  await expect(discard).toBeVisible();
  await expect(close).toHaveCount(0);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  // Writing on the card takes the hold back.
  await nativeField(page).fill('die');
  await expect(close).toBeVisible();
  await nativeField(page).fill('');

  // Escape asks the same way.
  await page.keyboard.press('Escape');
  await expect(entryDialog(page)).toBeVisible();
  await expect(discard).toBeVisible();
  await discard.click();
  await expect(entryDialog(page)).toBeHidden();
  await expect(page.getByLabel('journey auswählen')).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('Escape closes a blank card at once', async ({ page }) => {
  await page.goto('/?state=unit');
  await page.getByRole('button', { name: 'Vokabel eintragen' }).click();
  await expect(targetField(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(entryDialog(page)).toBeHidden();
});

// Pressing Escape is no user activation, so the browser closes the dialog on a
// second Escape right after the first, whatever the page does (see Modal).
// The next opening must still start from a blank card.
test('a second Escape while a word is filed closes the dialog', async ({
  page,
}) => {
  await page.goto('/?state=unit&filing=slow');
  const opener = page.getByRole('button', { name: 'Vokabel eintragen' });
  await opener.click();
  await targetField(page).fill('journey');
  await nativeField(page).fill('die Reise');
  await nativeField(page).press('Enter');
  await expect(status(page)).toHaveText('„journey“ wird eingetragen …');
  // Until the browser moves focus off the disabled field, a key pressed there
  // goes nowhere.
  await expect(nativeField(page)).not.toBeFocused();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(entryDialog(page)).toBeHidden();
  await expect(opener).toBeFocused();

  await opener.click();
  await expect(targetField(page)).toBeFocused();
  await expect(targetField(page)).toHaveValue('');
  await expect(nativeField(page)).toHaveValue('');
  await expect(status(page)).toHaveText('');
});

test('a second Escape discards a held word', async ({ page }) => {
  await page.goto('/?state=unit');
  const opener = page.getByRole('button', { name: 'Vokabel eintragen' });
  await opener.click();
  await targetField(page).fill('journey');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(entryDialog(page)).toBeHidden();
  await expect(opener).toBeFocused();

  await opener.click();
  await expect(targetField(page)).toBeFocused();
  await expect(targetField(page)).toHaveValue('');
  await expect(status(page)).toHaveText('');
});

test('a repeated word is pointed out before it is sent', async ({ page }) => {
  await page.goto('/?state=unit');
  await page.getByRole('button', { name: 'Vokabel eintragen' }).click();
  await targetField(page).fill('memory');
  await nativeField(page).fill('das Gedächtnis');
  await expect(
    page.getByText('„memory“ ist schon in Green Line 3 · Unit 3 – Holidays.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { exact: true, name: 'Eintragen' }),
  ).toBeDisabled();
  await targetField(page).fill('Memory');
  await expect(
    page.getByText(
      '„Memory“ ist schon in Green Line 3 · Unit 3 – Holidays, mit anderer Schreibweise oder anderem Beispielsatz.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { exact: true, name: 'Eintragen' }),
  ).toBeEnabled();
});

test('a typed entry can carry a generated example sentence', async ({
  page,
}) => {
  await page.goto('/?state=unit');
  await page.getByRole('button', { name: 'Vokabel eintragen' }).click();
  const generate = page.getByRole('button', { name: 'Beispielsatz erzeugen' });
  await expect(generate).toBeDisabled();
  await targetField(page).fill('journey');
  await nativeField(page).fill('die Reise');
  await expect(generate).toBeEnabled();
  await generate.click();
  const translation = page.getByLabel(
    'Deutsche Übersetzung des Beispielsatzes',
  );
  await expect(translation).toBeFocused();
  await expect(page.getByLabel('Beispielsatz (optional)')).toHaveValue(
    'We packed our bags for the journey.',
  );
  await expect(translation).toHaveValue(
    'Wir packten unsere Koffer für die Reise.',
  );
  await expect(
    page.getByText(
      'Mit KI erzeugt. Prüfe Satz und Übersetzung vor dem Eintragen.',
    ),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await page.getByRole('button', { exact: true, name: 'Eintragen' }).click();
  await expect(status(page)).toHaveText('„journey“ eingetragen.');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { exact: true, name: 'journey' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'journey' })
      .getByText('We packed our bags for the journey.'),
  ).toBeVisible();
});

test('a generated example sentence can be cleared and written anew', async ({
  page,
}) => {
  await page.goto('/?state=unit');
  await page.getByRole('button', { name: 'Vokabel eintragen' }).click();
  await targetField(page).fill('journey');
  await nativeField(page).fill('die Reise');
  await page.getByRole('button', { name: 'Beispielsatz erzeugen' }).click();
  const sentence = page.getByLabel('Beispielsatz (optional)');
  await expect(sentence).toHaveValue('We packed our bags for the journey.');
  await sentence.press('ControlOrMeta+A');
  await sentence.press('Backspace');
  await expect(sentence).toBeFocused();
  await page.keyboard.type('The journey took all day.');
  await expect(sentence).toHaveValue('The journey took all day.');
  await sentence.press('Tab');
  await expect(
    page.getByLabel('Deutsche Übersetzung des Beispielsatzes'),
  ).toHaveValue('Wir packten unsere Koffer für die Reise.');
  await page.getByRole('button', { exact: true, name: 'Eintragen' }).click();
  await expect(status(page)).toHaveText('„journey“ eingetragen.');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { exact: true, name: 'journey' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'journey' })
      .getByText('The journey took all day.'),
  ).toBeVisible();
});

test('an example sentence is only offered until one is written', async ({
  page,
}) => {
  await page.goto('/?state=unit');
  await page.getByRole('button', { name: 'Vokabel eintragen' }).click();
  const sentence = page.getByLabel('Beispielsatz (optional)');
  await expect(sentence).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Beispielsatz selbst schreiben' })
    .click();
  await expect(sentence).toBeFocused();
  await sentence.fill('The journey took all day.');
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('a missing pronunciation is reported without losing the entry', async ({
  page,
}) => {
  await page.goto('/?state=unit');
  await page.getByRole('button', { name: 'Vokabel eintragen' }).click();
  await targetField(page).fill('silence');
  await nativeField(page).fill('die Stille');
  await page.getByRole('button', { exact: true, name: 'Eintragen' }).click();
  await expect(status(page)).toHaveText(
    '„silence“ eingetragen. Die Aussprache konnte nicht erzeugt werden.',
  );
  await expect(page.getByLabel('silence auswählen')).toBeVisible();
});

test('an empty unit offers typing next to photographing', async ({ page }) => {
  await page.goto('/?state=unit-empty');
  await expect(
    page.getByRole('heading', { name: 'Vokabeln hinzufügen' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Vokabel eintragen' }),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Vokabel eintragen' }).click();
  await expect(targetField(page)).toBeFocused();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await targetField(page).fill('journey');
  await nativeField(page).fill('die Reise');
  await page.getByRole('button', { exact: true, name: 'Eintragen' }).click();
  await expect(status(page)).toHaveText('„journey“ eingetragen.');
  await expect(
    page.getByRole('heading', { exact: true, name: 'Vokabeln' }),
  ).toBeVisible();
  await expect(page.getByLabel('Vokabel suchen')).toBeVisible();
  await expect(page.getByLabel('journey auswählen')).toBeVisible();

  // The empty state's button is gone, so focus lands on the one that
  // replaced it.
  await entryDialog(page).getByRole('button', { name: 'Schließen' }).click();
  await expect(
    page.getByRole('button', { name: 'Vokabel eintragen' }),
  ).toBeFocused();
});

test('the missing side of a word pair can be proposed from either side', async ({
  page,
}) => {
  await page.goto('/?state=unit');
  await page.getByRole('button', { name: 'Vokabel eintragen' }).click();
  const suggest = page.getByRole('button', { name: 'Übersetzung vorschlagen' });
  await expect(suggest).toHaveCount(0);
  await targetField(page).fill('journey');
  await expect(suggest).toBeVisible();
  await suggest.click();
  await expect(nativeField(page)).toHaveValue('die Reise');
  await expect(nativeField(page)).toBeFocused();
  await expect(
    page.getByText('KI-Vorschlag. Prüfe ihn vor dem Eintragen.'),
  ).toBeVisible();
  await expect(suggest).toHaveCount(0);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await nativeField(page).fill('die Fahrt');
  await expect(page.getByText('KI-Vorschlag')).toHaveCount(0);
  await page.getByRole('button', { exact: true, name: 'Eintragen' }).click();
  await expect(status(page)).toHaveText('„journey“ eingetragen.');

  await nativeField(page).fill('die Stille');
  await suggest.click();
  await expect(targetField(page)).toHaveValue('the die Stille');
  await expect(targetField(page)).toBeFocused();
});

test('a proposed translation moves nothing on the card', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/?state=unit');
  await page.getByRole('button', { name: 'Vokabel eintragen' }).click();
  await targetField(page).fill('journey');
  const submit = page.getByRole('button', { exact: true, name: 'Eintragen' });
  const before = await submit.boundingBox();
  await page.getByRole('button', { name: 'Übersetzung vorschlagen' }).click();
  await expect(
    page.getByText('KI-Vorschlag. Prüfe ihn vor dem Eintragen.'),
  ).toBeVisible();
  expect((await submit.boundingBox())?.y).toBe(before?.y);
});
