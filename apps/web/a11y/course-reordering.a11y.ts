import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

const firstUnitDragHandlePattern = /Unit 3 – Holidays ziehen/u;
const secondUnitDragHandlePattern = /Unit 4 – Sport ziehen/u;
const secondOfThreePattern = /Position 2 von 3/u;
const centerDivisor = 2;
const dragSteps = 10;

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('units can be added and reordered with the drag keyboard controls', async ({
  page,
}) => {
  await page.goto('/?state=course');
  await page.getByRole('button', { name: 'Bearbeiten' }).click();

  const firstHandle = page.getByRole('button', {
    name: firstUnitDragHandlePattern,
  });
  await firstHandle.focus();
  await firstHandle.press('Space');
  // Each book has its own drag context and live region.
  const dragAnnouncement = page
    .locator('[aria-live="assertive"]')
    .filter({ hasText: 'Unit 3 – Holidays' });
  await expect(dragAnnouncement).toContainText('Position 1');
  await firstHandle.press('ArrowDown');
  await expect(dragAnnouncement).toContainText('Position 2');
  await firstHandle.press('Space');
  await expect(
    page.getByLabel('Status der Einheiten in Green Line 3'),
  ).toHaveText('Reihenfolge gespeichert.');
  await expect(
    page.getByRole('button', { name: firstUnitDragHandlePattern }),
  ).toHaveAccessibleName(secondOfThreePattern);

  const currentBook = page.getByRole('region', { name: 'Green Line 3' });
  await currentBook.getByLabel('Neue Einheit').fill('Unit 6 – At the airport');
  await currentBook.getByRole('button', { name: 'Einheit hinzufügen' }).click();
  await expect(
    page.getByLabel('Status beim Hinzufügen einer Einheit zu Green Line 3'),
  ).toHaveText('Unit 6 – At the airport hinzugefügt.');
  await expect(
    page.getByText('Unit 6 – At the airport', { exact: true }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('units can be reordered by dragging their handles', async ({ page }) => {
  await page.goto('/?state=course');
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  const source = page.getByRole('button', {
    name: firstUnitDragHandlePattern,
  });
  const target = page.getByRole('button', {
    name: secondUnitDragHandlePattern,
  });
  // Green Line 2 is listed first, so Green Line 3 may start below the fold.
  await page
    .getByRole('list', { name: 'Einheiten in Green Line 3' })
    .scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (sourceBox === null || targetBox === null) {
    throw new Error('Drag handles are not laid out.');
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / centerDivisor,
    sourceBox.y + sourceBox.height / centerDivisor,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / centerDivisor,
    targetBox.y + targetBox.height / centerDivisor,
    { steps: dragSteps },
  );
  await page.mouse.up();

  await expect(
    page.getByLabel('Status der Einheiten in Green Line 3'),
  ).toHaveText('Reihenfolge gespeichert.');
  await expect(
    page.getByRole('button', { name: firstUnitDragHandlePattern }),
  ).toHaveAccessibleName(secondOfThreePattern);
});

test('books can be added and renamed while editing the course', async ({
  page,
}) => {
  await page.goto('/?state=course');
  await page.getByRole('button', { name: 'Bearbeiten' }).click();

  await page.getByLabel('Neues Buch').fill('Green Line 4');
  await page.getByRole('button', { name: 'Buch hinzufügen' }).click();
  await expect(
    page.getByLabel('Status beim Hinzufügen eines Buchs'),
  ).toHaveText('Green Line 4 hinzugefügt.');
  const addedBook = page.getByRole('region', { name: 'Green Line 4' });
  await expect(addedBook).toBeVisible();

  await page.getByLabel('Neues Buch').fill('Green Line 2');
  await page.getByRole('button', { name: 'Buch hinzufügen' }).click();
  await expect(
    page.getByLabel('Status beim Hinzufügen eines Buchs'),
  ).toHaveText('Das Buch "Green Line 2" gibt es bereits.');

  await addedBook.getByLabel('Buchname').fill('Green Line 4 (Workbook)');
  await addedBook.getByRole('button', { name: 'Umbenennen' }).click();
  await expect(
    page.getByRole('region', { name: 'Green Line 4 (Workbook)' }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('the course page opens books with work left and folds finished ones', async ({
  page,
}) => {
  await page.goto('/?state=course');
  await expect(page.getByText('Unit 3 – Holidays')).toBeVisible();
  await expect(page.getByText('Unit 2 – School')).toBeHidden();
  await page.getByText('Green Line 2').click();
  await expect(page.getByText('Unit 2 – School')).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await page.goto('/?state=course-no-books');
  await expect(
    page.getByText('Dieser Kurs hat noch keine Bücher.', { exact: false }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
