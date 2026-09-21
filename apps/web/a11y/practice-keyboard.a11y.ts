import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const incorrectFeedbackDescription = /Noch nicht sicher.*Erwartet: memory/u;
const retypeDescription = /Erinnerung.*Vorlage: memory/u;

test('keyboard focus follows the practice loop', async ({ page }) => {
  await page.goto('/?state=practice-session');
  const answer = page.getByLabel('Deine Antwort');
  const next = page.getByRole('button', { name: 'Weiter' });

  await expect(answer).toBeFocused();
  await expect(answer).toHaveAccessibleDescription('Erinnerung');
  await answer.fill('wrong');
  await answer.press('Enter');
  // After a mistake the field asks for the answer to be written out; the
  // hand stays on the keyboard and Enter moves on once it matches.
  const retype = page.getByLabel('Schreib die Antwort ab');
  await expect(retype).toBeFocused();
  await expect(retype).toHaveAccessibleDescription(retypeDescription);
  await expect(next).toHaveAccessibleDescription(incorrectFeedbackDescription);
  await retype.fill('memory');
  await retype.press('Enter');

  await expect(
    page.getByRole('heading', { level: 2, name: 'Ferien' }),
  ).toBeVisible();
  await expect(answer).toBeFocused();
  await expect(answer).toHaveAccessibleDescription('Ferien');
});
