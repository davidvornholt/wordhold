import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('bulk new-unit Enter applies without submitting the page', async ({
  page,
}) => {
  await page.goto('/?state=verification-deferred');
  const bulkAssignment = page.getByRole('group', {
    name: 'Einheit zuordnen',
  });
  await bulkAssignment
    .getByLabel('Einheit für alle Vokabeln')
    .selectOption('new');
  const name = bulkAssignment.getByLabel('Name der Einheit');
  await name.press('Enter');
  await expect(page.getByLabel('Verification calls')).toHaveText('0');

  await name.fill('Unit 4');
  await name.press('Enter');

  await expect(page.getByLabel('Verification calls')).toHaveText('0');
  await expect(
    page
      .locator('form > ul > li')
      .first()
      .getByText('Einheit: Unit 4 (neu)', { exact: true }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
