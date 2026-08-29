import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('keyboard focus follows the practice loop', async ({ page }) => {
  await page.goto('/?state=practice-session');
  const answer = page.getByLabel('Deine Antwort');
  const next = page.getByRole('button', { name: 'Weiter' });

  await expect(answer).toBeFocused();
  await answer.fill('wrong');
  await answer.press('Enter');
  await expect(next).toBeFocused();
  await next.press('Enter');

  await expect(
    page.getByRole('heading', { level: 2, name: 'Ferien' }),
  ).toBeVisible();
  await expect(answer).toBeFocused();
});
