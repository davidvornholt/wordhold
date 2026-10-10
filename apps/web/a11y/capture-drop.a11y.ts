import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// Playwright's Page type reaches this file only through the test fixtures.
type Page = Parameters<Parameters<typeof test>[2]>[0]['page'];

// Playwright cannot drag files in from the desktop, so the drag is dispatched
// as the browser would while photos from the file manager cross the screen.
const dragFiles = async (
  page: Page,
  events: ReadonlyArray<'dragenter' | 'dragover' | 'drop'>,
) => {
  const transfer = await page.evaluateHandle(() => {
    const files = new DataTransfer();
    files.items.add(new File(['fixture'], 'page.jpg', { type: 'image/jpeg' }));
    return files;
  });
  for (const type of events) {
    // The browser fires drag events one after another.
    await page.dispatchEvent('body', type, { dataTransfer: transfer });
  }
};

test('a dropped photo joins the photo queue', async ({ page }) => {
  await page.goto('/?state=import');
  await expect(page.getByLabel('Fotos auswählen')).toBeAttached();

  await dragFiles(page, ['dragenter', 'dragover']);
  await expect(
    page.getByText('Loslassen, um die Fotos hinzuzufügen'),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await dragFiles(page, ['drop']);
  await expect(page.getByText('1 Foto ausgewählt')).toBeVisible();
  await expect(
    page.getByText('Mehrere JPEG-, PNG- oder WebP-Dateien'),
  ).toBeVisible();
});

test('a drop is refused once the batch is being processed', async ({
  page,
}) => {
  await page.goto('/?state=import-progress');
  await expect(page.getByText('1 von 3 Seiten verarbeitet')).toBeVisible();
  await dragFiles(page, ['dragenter', 'dragover']);
  await expect(
    page.getByText('Loslassen, um die Fotos hinzuzufügen'),
  ).toHaveCount(0);
  await dragFiles(page, ['drop']);
  await expect(page.getByText('1 von 3 Seiten verarbeitet')).toBeVisible();
  await expect(page.getByText('1 von 4 Seiten verarbeitet')).toHaveCount(0);
});
