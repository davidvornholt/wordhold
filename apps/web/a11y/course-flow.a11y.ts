import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('the course offers practice when its queue has work', async ({ page }) => {
  await page.goto('/?state=course');
  await expect(page.getByRole('button', { name: 'Üben' })).toBeVisible();
});

test('the course hides practice when its queue has no work', async ({
  page,
}) => {
  await page.goto('/?state=course-no-practice');
  await expect(page.getByRole('button', { name: 'Üben' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Seite fotografieren' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Einstellungen' }),
  ).toBeVisible();
});
