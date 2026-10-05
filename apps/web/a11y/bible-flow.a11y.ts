import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';
import { verse } from './text-fixture-data';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('a Bible reference typed as the title is looked up, read and saved', async ({
  page,
}) => {
  await page.goto('/?state=texts-course-empty');
  await page.getByRole('button', { name: 'Text eintragen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Text eintragen' });
  const title = dialog.getByRole('textbox', { exact: true, name: 'Titel' });
  const text = dialog.getByRole('textbox', { exact: true, name: 'Text' });
  const status = dialog.getByRole('status', {
    name: 'Status beim Eintragen eines Texts',
  });
  const save = dialog.getByRole('button', { exact: true, name: 'Eintragen' });

  await title.fill('joh 3,16');
  // Enter looks the text up while it is still empty.
  await title.press('Enter');
  await expect(title).toHaveValue('Johannes 3,16');
  await expect(text).toHaveValue(verse);
  await expect(status).toHaveText(
    '„Johannes 3,16“ nachgeschlagen. Lies den Text durch und trag ihn ein.',
  );
  await expect(save).toBeFocused();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await save.press('Enter');
  await expect(status).toHaveText('„Johannes 3,16“ eingetragen.');
  await expect(title).toBeFocused();
  await expect(title).toHaveValue('');
});

test('a passage that cannot be looked up is explained', async ({ page }) => {
  await page.goto('/?state=texts-course-empty');
  await page.getByRole('button', { name: 'Text eintragen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Text eintragen' });
  const title = dialog.getByRole('textbox', { exact: true, name: 'Titel' });
  const lookUp = dialog.getByRole('button', {
    name: 'In LUT1912 nachschlagen',
  });
  await expect(lookUp).toBeDisabled();

  await title.fill('Ps 23,5-8');
  await lookUp.click();
  await expect(
    dialog.getByRole('status', { name: 'Status beim Eintragen eines Texts' }),
  ).toHaveText('Psalm 23 hat in LUT1912 nur 6 Verse.');
  await expect(title).toBeFocused();
  await expect(title).toHaveValue('Ps 23,5-8');
});

test('Bibles are uploaded and removed in the collection settings', async ({
  page,
}) => {
  await page.goto('/?state=texts-settings');
  const bibles = page.getByRole('region', { name: 'Bibeln' });
  const status = bibles.getByRole('status', {
    name: 'Status beim Hochladen und Entfernen von Bibeln',
  });
  const file = bibles.getByLabel('Bibel im MySword-Format');
  const upload = bibles.getByRole('button', { name: 'Hochladen' });
  await expect(
    bibles.getByText('Lutherbibel 1912 · 31.173 Verse'),
  ).toBeVisible();
  await expect(upload).toBeDisabled();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await file.setInputFiles({
    name: 'Notizen.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Am Anfang'),
  });
  await upload.click();
  await expect(status).toHaveText(
    'Die Datei ist keine MySword-Bibel. Lade eine Datei hoch, deren Name auf „.bbl.mybible“ endet.',
  );

  await file.setInputFiles({
    name: 'KJV.bbl.mybible',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('SQLite format 3'),
  });
  await upload.click();
  await expect(status).toHaveText('KJV hochgeladen: 31.102 Verse.');
  await expect(bibles.getByText('31.102 Verse', { exact: true })).toBeVisible();
  await expect(upload).toBeDisabled();

  // A removed Bible's button is gone, so focus moves to the list's heading.
  const heading = bibles.getByRole('heading', { name: 'Bibeln' });
  await bibles.getByRole('button', { name: 'KJV entfernen' }).click();
  await page
    .getByRole('dialog', { name: 'KJV entfernen?' })
    .getByRole('button', { name: 'Entfernen' })
    .click();
  await expect(status).toHaveText('KJV entfernt.');
  await expect(heading).toBeFocused();

  const removeLuther = bibles.getByRole('button', {
    name: 'LUT1912 entfernen',
  });
  await removeLuther.click();
  const dialog = page.getByRole('dialog', { name: 'LUT1912 entfernen?' });
  await expect(
    dialog.getByText(
      'Die Bibel wird gelöscht. Texte, die du aus ihr eingetragen hast, bleiben in deinen Sammlungen.',
    ),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  // A kept Bible still has its button, which gets focus back.
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(removeLuther).toBeFocused();

  await removeLuther.click();
  await dialog.getByRole('button', { name: 'Entfernen' }).click();
  await expect(status).toHaveText('LUT1912 entfernt.');
  await expect(bibles.getByText('Lutherbibel 1912')).toHaveCount(0);
  await expect(heading).toBeFocused();
});
