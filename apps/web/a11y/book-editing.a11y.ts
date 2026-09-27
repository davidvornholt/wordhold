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
  await page.goto('/?state=book');
  await page.getByRole('button', { name: 'Bearbeiten' }).click();

  const firstHandle = page.getByRole('button', {
    name: firstUnitDragHandlePattern,
  });
  await firstHandle.focus();
  await firstHandle.press('Space');
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

  await page.getByLabel('Neue Einheit').fill('Unit 6 – At the airport');
  await page.getByRole('button', { name: 'Einheit hinzufügen' }).click();
  await expect(
    page.getByLabel('Status beim Hinzufügen einer Einheit zu Green Line 3'),
  ).toHaveText('Unit 6 – At the airport hinzugefügt.');
  await expect(
    page.getByText('Unit 6 – At the airport', { exact: true }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  const done = page.getByRole('button', { name: 'Fertig' });
  await expect(done).toHaveAttribute('aria-expanded', 'true');
  await done.click();
  await expect(page.getByRole('listitem').getByRole('button')).toHaveText([
    'Unit 4 – Sport',
    'Unit 3 – Holidays',
    'Unit 5 – Empty',
    'Unit 6 – At the airport',
  ]);
});

test('units can be reordered by dragging their handles', async ({ page }) => {
  await page.goto('/?state=book');
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  const source = page.getByRole('button', {
    name: firstUnitDragHandlePattern,
  });
  const target = page.getByRole('button', {
    name: secondUnitDragHandlePattern,
  });
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

test('a book is renamed on its own page', async ({ page }) => {
  await page.goto('/?state=book');
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  const name = page.getByLabel('Buchname');
  const status = page.getByLabel('Status beim Umbenennen des Buchs');

  await name.fill('Green Line 2');
  await page.getByRole('button', { name: 'Umbenennen' }).click();
  await expect(status).toHaveText('Das Buch "Green Line 2" gibt es bereits.');

  await name.fill('Green Line 3 (Workbook)');
  await page.getByRole('button', { name: 'Umbenennen' }).click();
  await expect(status).toHaveText('Umbenannt in Green Line 3 (Workbook).');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Green Line 3 (Workbook)' }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('a book without units offers units as an option while editing', async ({
  page,
}) => {
  await page.goto('/?state=book-novel');
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await expect(
    page.getByText('Einheiten sind optional.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Einheiten in The Hobbit' }),
  ).toHaveCount(0);
  await expect(page.getByLabel('burglar auswählen')).toHaveCount(0);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await page.getByLabel('Neue Einheit').fill('Chapter 1');
  await page.getByRole('button', { name: 'Einheit hinzufügen' }).click();
  await expect(
    page.getByRole('list', { name: 'Einheiten in The Hobbit' }),
  ).toContainText('Chapter 1');
  await page.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.getByLabel('burglar auswählen')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Einheiten' })).toBeVisible();
});

test('a new book opens its own page, ready for its first words', async ({
  page,
}) => {
  await page.goto('/?state=course');
  const toggle = page.getByRole('button', { name: 'Neues Buch' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  const name = page.getByLabel('Name des Buchs');
  await name.fill('Green Line 2');
  await page.getByRole('button', { name: 'Buch anlegen' }).click();
  await expect(page.getByLabel('Status beim Anlegen eines Buchs')).toHaveText(
    'Das Buch "Green Line 2" gibt es bereits.',
  );
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await name.fill('Harry Potter');
  await page.getByRole('button', { name: 'Buch anlegen' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'book-new',
  );
  await expect(
    page.getByRole('heading', { level: 1, name: 'Harry Potter' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Vokabel eintragen' }),
  ).toBeVisible();
});

test('the course page explains how a language without books starts', async ({
  page,
}) => {
  await page.goto('/?state=course-no-books');
  await expect(
    page.getByText('Für diese Sprache gibt es noch keine Bücher.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Neues Buch' })).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
