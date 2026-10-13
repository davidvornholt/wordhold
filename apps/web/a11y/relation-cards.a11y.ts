import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('a synonym card asks in English and takes any one of its synonyms', async ({
  page,
}) => {
  await page.goto('/?state=synonym-practice');
  await expect(page.getByText('Synonym of', { exact: true })).toHaveAttribute(
    'lang',
    'en',
  );
  await expect(page.getByRole('heading', { name: 'hostile' })).toHaveAttribute(
    'lang',
    'en',
  );
  const answer = page.getByLabel('Deine Antwort');
  await expect(answer).toBeFocused();
  await answer.fill('friendly');
  await answer.press('Enter');

  await expect(
    page.getByRole('status').getByText('unfriendly, aggressive'),
  ).toHaveAttribute('lang', 'en');
  const retype = page.getByLabel('Schreib die Antwort ab');
  await expect(retype).toBeFocused();
  await retype.fill('friendly');
  await retype.press('Enter');
  await expect(
    page.getByText('Noch nicht ganz. Schreib eines der Wörter genau so ab.'),
  ).toBeVisible();

  await retype.fill('aggressive');
  await retype.press('Enter');
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'practice-empty',
  );
});
