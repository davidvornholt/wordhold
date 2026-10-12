import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('a French answer gets its accents from the corner of the field', async ({
  page,
}) => {
  await page.goto('/?state=french-practice');
  const answer = page.getByLabel('Deine Antwort');
  await expect(answer).toBeFocused();
  const toggle = page.getByRole('button', { name: 'Sonderzeichen' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const cedilla = page.getByRole('button', { name: 'c mit Cedille' });
  await expect(cedilla).toBeHidden();

  await toggle.click();
  await expect(answer).toBeFocused();
  await answer.pressSequentially('le gar');
  await cedilla.click();
  await expect(answer).toBeFocused();
  await answer.pressSequentially('on');
  await expect(answer).toHaveValue('le garçon');

  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByText('Richtig')).toBeVisible();
  // A judged answer takes no more characters.
  await expect(page.getByRole('button', { name: 'Sonderzeichen' })).toHaveCount(
    0,
  );
});

test('an English answer offers no special characters', async ({ page }) => {
  await page.goto('/?state=practice-session');
  await expect(page.getByLabel('Deine Antwort')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Sonderzeichen' })).toHaveCount(
    0,
  );
});
