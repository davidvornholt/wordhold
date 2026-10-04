import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('a round of sentences is translated, corrected and summed up', async ({
  page,
}) => {
  await page.goto('/?state=sentence-practice');
  await expect(page.getByText('Übersetze auf Englisch')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'Meine Schwester arbeitet in einem Krankenhaus.',
    }),
  ).toBeVisible();
  // The sentence without a German side has left the round.
  await expect(page.getByText('0 von 2 Sätzen bearbeitet')).toBeVisible();
  const field = page.getByLabel('Deine Übersetzung');
  await expect(field).toBeFocused();
  await expect(field).toHaveAccessibleDescription(
    'Meine Schwester arbeitet in einem Krankenhaus. Verwende das Wort für „Schwester“.',
  );
  await expect(field).toHaveAttribute('lang', 'en');

  await field.fill('My sister is working at a hospitel.');
  await field.press('Enter');
  const feedback = page.getByRole('status');
  await expect(feedback).toContainText('Noch nicht richtig');
  await expect(feedback).toContainText(
    'Korrigiert: My sister is working at a hospital.',
  );
  await expect(feedback).toContainText(
    'Musterlösung: My sister works in a hospital.',
  );
  const next = page.getByRole('button', { name: 'Weiter' });
  await expect(next).toBeFocused();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await next.press('Enter');
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'Ich lese gerade ein spannendes Buch.',
    }),
  ).toBeVisible();
  await expect(page.getByText('1 von 2 Sätzen bearbeitet')).toBeVisible();
  await expect(field).toBeFocused();
  await field.fill("I'm reading an exciting book.");
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByRole('status')).toContainText('Richtig');
  await expect(page.getByRole('status')).toContainText(
    'Auch möglich: I am reading an exciting book.',
  );

  await page.getByRole('button', { name: 'Weiter' }).click();
  const heading = page.getByRole('heading', {
    level: 2,
    name: 'Runde beendet',
  });
  await expect(heading).toBeFocused();
  await expect(page.getByText('2 Sätze', { exact: true })).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('a sentence given up on shows the stored translation', async ({
  page,
}) => {
  await page.goto('/?state=sentence-practice');
  await page.getByRole('button', { name: 'Weiß ich nicht' }).click();
  await expect(page.getByRole('status')).toContainText('Nicht gewusst');
  await expect(page.getByRole('status')).toContainText(
    'Musterlösung: My sister works in a hospital.',
  );
  await expect(page.getByRole('button', { name: 'Weiter' })).toBeFocused();
});
