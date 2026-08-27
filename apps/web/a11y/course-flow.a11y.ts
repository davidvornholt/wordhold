import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const unitActionPattern = /lernen$|üben$/u;

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

test('empty units do not claim to be learned or offer work', async ({
  page,
}) => {
  await page.goto('/?state=course');
  const emptyUnit = page
    .getByRole('listitem')
    .filter({ hasText: 'Unit 5 – Empty' });
  await expect(emptyUnit.getByText('Noch keine Wörter')).toBeVisible();
  await expect(emptyUnit.getByText('alle gelernt')).toHaveCount(0);

  await page.goto('/?state=unit-empty');
  await expect(page.getByText('Noch keine Wörter')).toBeVisible();
  await expect(page.getByText('alle gelernt')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: unitActionPattern }),
  ).toHaveCount(0);
});
