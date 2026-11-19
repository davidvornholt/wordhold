import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

// Playwright's Page type reaches this file only through the test fixtures.
type Page = Parameters<Parameters<typeof test>[2]>[0]['page'];

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// The notice must leave the book's word for the next try to find.
const expectNoSolution = async (page: Page) => {
  expect(await page.content()).not.toContain('enfocarse');
  await expect(page.getByText('Erwartet')).toHaveCount(0);
  await expect(page.getByText('Vertippt?')).toHaveCount(0);
};

test('practice for a test leaves a translation in other words open for another try', async ({
  page,
}) => {
  await page.goto('/?state=practice-other-wording');
  const answer = page.getByLabel('Deine Antwort');
  const notice = page
    .getByRole('status')
    .filter({ hasText: 'Auch richtig, aber hier ist ein anderes Wort' });

  await answer.fill('centrarse en algo');
  await answer.press('Enter');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(
    'Auch richtig, aber hier ist ein anderes Wort aus dem Buch gesucht.',
  );
  await expect(notice).toContainText('Deine Antwort: centrarse en algo');
  await expect(answer).toHaveValue('');
  await expect(answer).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Weiß ich nicht' }),
  ).toBeVisible();
  await expectNoSolution(page);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  // A word the course teaches elsewhere is named with its unit.
  await answer.fill('concentrarse en algo');
  await answer.press('Enter');
  await expect(notice).toContainText(
    'Auch richtig, aber hier ist ein anderes Wort gesucht.',
  );
  await expect(notice).toContainText(
    '‚concentrarse en algo‘ steht in U5 Y después del instituto, ¿qué? / ¡Acércate!',
  );
  await expect(
    notice.getByText('concentrarse en algo', { exact: true }).first(),
  ).toHaveAttribute('lang', 'es');
  await expect(notice).toContainText('Deine Antwort: concentrarse en algo');
  await expect(answer).toHaveValue('');
  await expect(answer).toBeFocused();
  await expectNoSolution(page);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  // The next try is graded as a first answer would be.
  await answer.fill('enfocarse en algo');
  await answer.press('Enter');
  await expect(page.getByText('Richtig', { exact: true })).toBeVisible();
  await expect(notice).toHaveCount(0);
});

test('other practice counts a translation in other words as right', async ({
  page,
}) => {
  await page.goto('/?state=practice-other-wording-accepted');
  const answer = page.getByLabel('Deine Antwort');

  await answer.fill('concentrarse en algo');
  await answer.press('Enter');
  const feedback = page.getByRole('status').filter({ hasText: 'Im Buch' });
  await expect(feedback.getByText('Richtig', { exact: true })).toBeVisible();
  await expect(feedback).toContainText('Im Buch: enfocarse en algo');
  await expect(
    feedback.getByText('enfocarse en algo', { exact: true }),
  ).toHaveAttribute('lang', 'es');
  await expect(feedback).toContainText(
    'Im Test zählt nur das Wort aus dem Buch.',
  );
  await expect(page.getByText('Erwartet')).toHaveCount(0);
  await expect(page.getByText('Vertippt?')).toHaveCount(0);
  await expect(page.getByText('Gesucht ist')).toHaveCount(0);
  await expect(page.getByText('anderes Wort')).toHaveCount(0);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
