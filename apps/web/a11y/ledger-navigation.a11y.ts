import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const uncertainRowIndex = 3;

test('Enter moves down a column of the ledger and never imports the page', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  const rows = page.locator('form li[data-row-id]');
  const firstTerm = rows.first().getByLabel('Englisch');
  await firstTerm.focus();
  await firstTerm.press('Enter');
  await expect(rows.nth(1).getByLabel('Englisch')).toBeFocused();
  await page.keyboard.press('Shift+Enter');
  await expect(firstTerm).toBeFocused();

  const firstSentence = rows
    .first()
    .getByLabel('Beispielsatz', { exact: true });
  await firstSentence.focus();
  await firstSentence.press('Enter');
  await expect(
    rows.nth(1).getByLabel('Beispielsatz', { exact: true }),
  ).toBeFocused();
  await expect(firstSentence).toHaveValue('The journey takes three hours.');

  const lastTerm = rows.last().getByLabel('Englisch');
  await lastTerm.focus();
  await lastTerm.press('Enter');
  await expect(lastTerm).toBeFocused();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'verification',
  );
});

test('the checklist jumps from one uncertain reading to the next', async ({
  page,
}) => {
  await page.goto('/?state=verification');
  const checklist = page.getByRole('region', { name: 'Vor dem Import' });
  const jump = checklist.getByRole('button', {
    name: '1 unsicher gelesen – zum nächsten springen',
  });
  await jump.click();
  const uncertainTerm = page
    .locator('form li[data-row-id]')
    .nth(uncertainRowIndex)
    .getByLabel('Englisch');
  await expect(uncertainTerm).toBeFocused();
  await expect(uncertainTerm).toHaveValue('accommodation');
  await expect(uncertainTerm).toBeInViewport();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('a removed entry can be restored where it was', async ({ page }) => {
  await page.goto('/?state=verification');
  const rows = page.locator('form li[data-row-id]');
  await page.getByRole('button', { name: 'Eintrag 2 entfernen' }).click();

  await expect(rows).toHaveCount(11);
  // The removed entry leaves a line in its place to undo from, and the
  // status line announces the removal.
  const removedLine = page
    .getByRole('listitem')
    .filter({ hasText: '„luggage“ entfernt.' });
  await expect(removedLine).toBeVisible();
  await expect(
    page.getByRole('status').getByText('„luggage“ entfernt.'),
  ).toBeAttached();
  // The next entry moves up into the removed one's place, and so does focus.
  await expect(
    page.getByRole('button', { name: 'Eintrag 2 entfernen' }),
  ).toBeFocused();
  await expect(rows.nth(1).getByLabel('Englisch')).toHaveValue('to set off');
  await expect(
    page.getByRole('button', { name: '11 Einträge importieren' }),
  ).toBeEnabled();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await removedLine.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(rows).toHaveCount(12);
  const restored = rows.nth(1).getByLabel('Englisch');
  await expect(restored).toHaveValue('luggage');
  await expect(restored).toBeFocused();
  await expect(removedLine).toHaveCount(0);
});

test('removing every entry leaves focus on adding one', async ({ page }) => {
  await page.goto('/?state=verification-deferred');
  await page.getByRole('button', { name: 'Eintrag 1 entfernen' }).click();
  await expect(page.locator('form li[data-row-id]')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Eintrag hinzufügen' }),
  ).toBeFocused();
  await expect(
    page.getByText('Diese Seite hat noch keine Einträge.'),
  ).toBeVisible();
  // Nothing is left to import until an entry is added again.
  await expect(
    page.getByRole('button', { name: 'Seite abschließen' }),
  ).toBeDisabled();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
