import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const firstReviewPattern = /erste Abfrage/u;
const backlogPattern = /6 noch kennenlernen/u;

test('a resting course leads with new vocabulary without exposing the backlog', async ({
  page,
}) => {
  await page.goto('/?state=dashboard-learning');

  await expect(page.getByText('Alles für heute wiederholt')).toBeVisible();
  await expect(page.getByText('Neue Vokabeln verfügbar')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Neue Vokabeln kennenlernen' }),
  ).toBeVisible();
  await expect(page.getByText(firstReviewPattern)).toHaveCount(0);
  await expect(page.getByText(backlogPattern)).toHaveCount(0);
});
