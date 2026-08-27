import { expect, test } from '@playwright/test';

const drillActionPattern = /üben$/u;

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// The night-before path: the course page leads into a unit, the unit shows its
// words and offers to drill the ones already learned.
test('the drill reaches a unit sitting through the course page', async ({
  page,
}) => {
  await page.goto('/?state=dashboard');
  await page.getByRole('button', { name: 'English A2' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'course');

  await page.getByRole('button', { name: 'Unit 3 – Holidays' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'unit');
  await expect(page.getByText('to look (at)')).toBeVisible();
  await expect(page.getByText('ansehen')).toBeVisible();

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

// A drill of a unit nobody has met would have no card to ask, so the unit
// offers only the learning pass.
test('a unit without learned words offers nothing to drill', async ({
  page,
}) => {
  await page.goto('/?state=unit-fresh');
  await expect(page.getByRole('button', { name: '12 lernen' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: drillActionPattern }),
  ).toHaveCount(0);
});
