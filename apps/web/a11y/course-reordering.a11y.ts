import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

const firstUnitDragHandlePattern = /Unit 3 – Holidays ziehen/u;
const secondUnitDragHandlePattern = /Unit 4 – Sport ziehen/u;
const secondOfFourPattern = /Position 2 von 4/u;
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
  const dragAnnouncement = page.locator('[aria-live="assertive"]');
  await expect(dragAnnouncement).toContainText('Position 1');
  await firstHandle.press('ArrowDown');
  await expect(dragAnnouncement).toContainText('Position 2');
  await firstHandle.press('Space');
  await expect(page.getByLabel('Status der Einheitenverwaltung')).toHaveText(
    'Reihenfolge gespeichert.',
  );
  await expect(
    page.getByRole('button', { name: firstUnitDragHandlePattern }),
  ).toHaveAccessibleName(secondOfFourPattern);

  await page.getByLabel('Neue Einheit').fill('Unit 6 – At the airport');
  await page.getByRole('button', { name: 'Einheit hinzufügen' }).click();
  await expect(
    page.getByLabel('Status beim Hinzufügen einer Einheit'),
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

  await expect(page.getByLabel('Status der Einheitenverwaltung')).toHaveText(
    'Reihenfolge gespeichert.',
  );
  await expect(
    page.getByRole('button', { name: firstUnitDragHandlePattern }),
  ).toHaveAccessibleName(secondOfFourPattern);
});
