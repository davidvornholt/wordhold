import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const daysInWeek = 7;
const firstReviewPattern = /erste Abfrage/u;
const backlogPattern = /6 noch kennenlernen/u;

test('the overview opens with today, one primary action and the week', async ({
  page,
}) => {
  await page.goto('/?state=dashboard');

  await expect(
    page.getByRole('heading', { level: 1, name: '6 Karten bereit' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jetzt üben' })).toBeVisible();
  const week = page.getByRole('list', { name: 'Die letzten sieben Tage' });
  await expect(week.getByRole('listitem')).toHaveCount(daysInWeek);
  await expect(week.getByText('Do: nicht geübt')).toBeAttached();
  await expect(week.getByText('Heute: geübt')).toBeAttached();
  await expect(page.getByText('4 Tage in Folge')).toBeVisible();
  await expect(page.getByText('9 von 18 sicher')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Wordhold' })).toBeVisible();
  await expect(page.getByText('Angemeldet als David')).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('a resting course leads with new vocabulary without exposing the backlog', async ({
  page,
}) => {
  await page.goto('/?state=dashboard-learning');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Alles für heute wiederholt' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jetzt üben' })).toHaveCount(0);
  await expect(page.getByText('Neue Vokabeln verfügbar')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Neue Vokabeln kennenlernen' }),
  ).toBeVisible();
  await expect(page.getByText(firstReviewPattern)).toHaveCount(0);
  await expect(page.getByText(backlogPattern)).toHaveCount(0);
});

test('an empty account shows an open week and no streak', async ({ page }) => {
  await page.goto('/?state=dashboard-empty');

  await expect(page.getByText('Noch keine Serie')).toBeVisible();
  await expect(page.getByText('Noch keine Vokabeln.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jetzt üben' })).toHaveCount(0);
});

test('with several courses the Heute action names the course it opens', async ({
  page,
}) => {
  await page.goto('/?state=dashboard-two-courses');

  await expect(
    page.getByRole('heading', { level: 1, name: '26 Karten bereit' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jetzt üben' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Französisch üben · 20 Karten' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '6 Karten üben' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '20 Karten üben' }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
