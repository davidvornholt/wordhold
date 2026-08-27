import { expect, test } from '@playwright/test';

const drillActionPattern = /üben$/u;

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// The night-before path: the dashboard offers a drill, the unit list offers
// only units that hold learned words, and picking one leads into a sitting.
test('the drill reaches a unit sitting and only offers units with learned words', async ({
  page,
}) => {
  await page.goto('/?state=dashboard');
  await page.getByRole('button', { name: 'Einheit üben' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'drill-units',
  );

  await expect(page.getByRole('button', { name: '16 üben' })).toBeVisible();
  await expect(page.getByText('Unit 4 – Sport')).toBeVisible();
  await expect(
    page.getByRole('button', { name: drillActionPattern }),
  ).toHaveCount(1);

  await page.getByRole('button', { name: '16 üben' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'drill-start',
  );
  await page.getByRole('button', { name: 'Deutsch → Englisch' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'drill-session',
  );
});
