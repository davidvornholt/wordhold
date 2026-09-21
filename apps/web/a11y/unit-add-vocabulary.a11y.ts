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

test('a unit takes typed vocabulary one word after another', async ({
  page,
}) => {
  await page.goto('/?state=unit');
  await expect(targetField(page)).toHaveCount(0);
  const toggle = page.getByRole('button', { name: 'Vokabel eintragen' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  const target = targetField(page);
  await expect(target).toBeFocused();
  await expect(page.getByRole('button', { name: 'Fertig' })).toHaveAttribute(
    'aria-expanded',
    'true',
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
  await expect(
    page.getByRole('listitem').filter({ hasText: 'journey' }),
  ).toContainText('die Reise');
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await page.getByRole('button', { name: 'Fertig' }).click();
  await expect(targetField(page)).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Vokabel eintragen' }),
  ).toBeFocused();
});

test('a repeated word is pointed out before it is sent', async ({ page }) => {
  await page.goto('/?state=unit');
  await page.getByRole('button', { name: 'Vokabel eintragen' }).click();
  await targetField(page).fill('memory');
  await nativeField(page).fill('das Gedächtnis');
  await expect(
    page.getByText('„memory“ ist schon in dieser Einheit.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { exact: true, name: 'Eintragen' }),
  ).toBeDisabled();
  await targetField(page).fill('Memory');
  await expect(
    page.getByText(
      '„Memory“ ist schon in dieser Einheit, mit anderer Schreibweise oder anderem Beispielsatz.',
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
  const added = page.getByRole('listitem').filter({ hasText: 'journey' });
  await added.locator('summary').click();
  await expect(
    added.getByText('We packed our bags for the journey.'),
  ).toBeVisible();
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
  await expect(
    page.getByRole('button', { name: 'Seite fotografieren' }),
  ).toHaveCount(0);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await targetField(page).fill('journey');
  await nativeField(page).fill('die Reise');
  await page.getByRole('button', { exact: true, name: 'Eintragen' }).click();
  await expect(status(page)).toHaveText('„journey“ eingetragen.');
  await expect(page.getByRole('heading', { name: 'Vokabeln' })).toBeVisible();
  await expect(page.getByLabel('Vokabel suchen')).toBeVisible();
  await expect(page.getByLabel('journey auswählen')).toBeVisible();
});
