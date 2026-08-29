import { expect, test } from '@playwright/test';

const practiceActionPattern = /üben$/u;
const forwardDirectionPattern = /Deutsch → Englisch/u;

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// The night-before path: the course page leads into a unit action page, which
// offers free practice for entries already introduced without duplicating the
// vocabulary inventory.
test('selected practice reaches a unit sitting through the course page', async ({
  page,
}) => {
  await page.goto('/?state=dashboard');
  await page.getByRole('button', { name: 'English A2' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'course');

  await page.getByRole('button', { name: 'Unit 3 – Holidays' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'unit');
  await expect(page.getByText('to look (at)')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Vokabelliste dieser Einheit' }),
  ).toBeVisible();

  await page.getByRole('button', { name: '16 Vokabeln üben' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'study-start',
  );
  await page.getByRole('radio', { name: forwardDirectionPattern }).check();
  await page.getByRole('button', { name: '16 Karten starten' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'study-session',
  );
});

// Free practice for a unit nobody has met would have no card to ask, so the unit
// offers only the learning pass.
test('a unit without introduced entries offers only kennenlernen', async ({
  page,
}) => {
  await page.goto('/?state=unit-unintroduced');
  await expect(
    page.getByRole('button', { name: '12 kennenlernen' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: practiceActionPattern }),
  ).toHaveCount(0);
});
