import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const note = 'Das c hört man nicht, wie in adolescence.';
const feedbackDescription = /Richtig.*adolescent, achte auf sc.*Das c hört/u;

test('the learning card shows the spelling pitfall while the answer is shown', async ({
  page,
}) => {
  await page.goto('/?state=learn&pitfalls=true');
  await expect(
    page.getByRole('heading', { level: 2, name: 'der/die Jugendliche' }),
  ).toBeVisible();
  // The pitfall is prepared after the pass opens.
  await expect(page.getByText(note)).toBeVisible();
  await expect(page.locator('mark')).toHaveText('sc');
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  // Typing hides it with the answer, and a miss shows both again.
  const answer = page.getByLabel('Schreib die Antwort');
  await answer.fill('adole');
  await expect(page.getByText(note)).toBeHidden();
  await answer.fill('adolesent');
  await answer.press('Enter');
  await expect(
    page.getByText('Noch nicht ganz. Schreib die Vokabel genau so ab.'),
  ).toBeVisible();
  await expect(page.getByText(note)).toBeVisible();
});

test('the feedback of a right answer names the spelling pitfall', async ({
  page,
}) => {
  await page.goto('/?state=practice&pitfalls=true');
  await expect(page.getByText(note)).toHaveCount(0);
  const answer = page.getByLabel('Deine Antwort');
  await answer.fill('adolescent');
  await answer.press('Enter');

  await expect(page.getByText('Richtig', { exact: true })).toBeVisible();
  await expect(page.getByText(note)).toBeVisible();
  await expect(page.locator('mark')).toHaveText('sc');
  await expect(
    page.getByRole('button', { name: 'Weiter' }),
  ).toHaveAccessibleDescription(feedbackDescription);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
