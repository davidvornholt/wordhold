import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// Playwright cannot write the system clipboard in headless Chromium, so the
// paste is dispatched as the browser would after Ctrl+V with an image copied.
const pasteFiles = (
  files: ReadonlyArray<{ readonly name: string; readonly type: string }>,
) => {
  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(new File(['fixture'], file.name, { type: file.type }));
  }
  document.dispatchEvent(
    new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: transfer,
    }),
  );
};

test('a pasted image joins the photo queue', async ({ page }) => {
  await page.goto('/?state=import');
  await expect(page.getByLabel('Fotos auswählen')).toBeAttached();
  await expect(page.getByText('Fotos ausgewählt')).toHaveCount(0);

  await page.evaluate(pasteFiles, [{ name: 'image.png', type: 'image/png' }]);
  await expect(page.getByText('1 Foto ausgewählt')).toBeVisible();

  await page.evaluate(pasteFiles, [
    { name: 'notes.txt', type: 'text/plain' },
    { name: 'page.jpg', type: 'image/jpeg' },
  ]);
  await expect(page.getByText('2 Fotos ausgewählt')).toBeVisible();
});

test('a paste is ignored once the batch is being processed', async ({
  page,
}) => {
  await page.goto('/?state=import-progress');
  await expect(page.getByText('1 von 3 Seiten verarbeitet')).toBeVisible();
  await page.evaluate(pasteFiles, [{ name: 'image.png', type: 'image/png' }]);
  await expect(page.getByText('1 von 3 Seiten verarbeitet')).toBeVisible();
  await expect(page.getByText('1 von 4 Seiten verarbeitet')).toHaveCount(0);
});
