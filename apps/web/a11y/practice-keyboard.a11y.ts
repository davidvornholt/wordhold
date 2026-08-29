import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const incorrectFeedbackDescription = /Leider falsch.*Erwartet: memory/u;

test('keyboard focus follows the practice loop', async ({ page }) => {
  await page.goto('/?state=practice-session');
  const answer = page.getByLabel('Deine Antwort');
  const next = page.getByRole('button', { name: 'Weiter' });

  await expect(answer).toBeFocused();
  await expect(answer).toHaveAccessibleDescription('Erinnerung');
  await answer.fill('wrong');
  await answer.press('Enter');
  await expect(next).toBeFocused();
  await expect(next).toHaveAccessibleDescription(incorrectFeedbackDescription);
  await next.press('Enter');

  await expect(
    page.getByRole('heading', { level: 2, name: 'Ferien' }),
  ).toBeVisible();
  await expect(answer).toBeFocused();
  await expect(answer).toHaveAccessibleDescription('Ferien');
});
