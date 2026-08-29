import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// Nothing in the learning pass is graded, but it does decide which entries the
// scheduler is allowed to ask about, so an entry must not count as met until it
// has actually been written correctly.
test('the learning pass asks again for a wrong copy and records only the correct ones', async ({
  page,
}) => {
  await page.goto('/?state=learn');
  const field = page.getByLabel('Schreib die Antwort');
  const advance = page.getByRole('button', { name: 'Weiter' });
  const progress = page.getByText('von 2 Abfragerichtungen kennengelernt');
  await expect(progress).toHaveText('0 von 2 Abfragerichtungen kennengelernt');
  await expect(field).toBeFocused();
  await expect(field).toHaveAccessibleDescription(
    'die Erinnerung Vorlage: memory',
  );
  await expect(field).toHaveAttribute('placeholder', 'memory');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  const answerHint = page.locator('span.sr-only', {
    has: page.locator('[lang="en"]', { hasText: 'memory' }),
  });
  const prompt = page.getByRole('heading', {
    level: 2,
    name: 'die Erinnerung',
  });
  await expect(answerHint).not.toHaveAttribute('lang');
  await expect(field).toHaveAttribute(
    'aria-describedby',
    `${(await prompt.getAttribute('id')) ?? 'missing-prompt'} ${(await answerHint.getAttribute('id')) ?? 'missing-answer-hint'}`,
  );
  await expect(answerHint).toHaveText('Vorlage: memory');

  await field.fill('r');
  await expect(field).toHaveAttribute(
    'aria-describedby',
    (await prompt.getAttribute('id')) ?? 'missing-prompt',
  );
  await expect(answerHint).toHaveCount(0);

  await field.fill('remember');
  await field.press('Enter');
  await expect(
    page.getByText('Noch nicht ganz. Schreib die Vokabel genau so ab.'),
  ).toBeVisible();
  await expect(field).toHaveValue('');
  await expect(advance).toBeDisabled();
  await expect(field).toBeFocused();
  await expect(progress).toHaveText('0 von 2 Abfragerichtungen kennengelernt');
  await expect(page.getByLabel('Introduced directions')).toHaveText('0');

  await field.fill('Memory');
  await field.press('Enter');
  await expect(progress).toHaveText('1 von 2 Abfragerichtungen kennengelernt');
  await expect(field).toBeFocused();
  await expect(field).toHaveAccessibleDescription(
    'to look (at) Vorlage: ansehen',
  );
  await expect(field).toHaveAttribute('placeholder', 'ansehen');
  await expect(page.getByLabel('Introduced directions')).toHaveText('1');

  await page.getByLabel('Schreib die Antwort').fill('ansehen');
  await page.getByLabel('Schreib die Antwort').press('Enter');
  await expect(progress).toHaveText('2 von 2 Abfragerichtungen kennengelernt');
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: '2 Abfragerichtungen kennengelernt',
    }),
  ).toBeFocused();
  await expect(page.getByLabel('Introduced directions')).toHaveText('2');
});

test('the learning pass announces a persistence failure and retries the same entry', async ({
  page,
}) => {
  await page.goto('/?state=learn-retry');
  const field = page.getByLabel('Schreib die Antwort');
  await field.fill('memory');
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(page.getByRole('alert')).toHaveText(
    'Die Vokabel wurde nicht gespeichert. Versuch es noch einmal.',
  );
  await expect(
    page.getByText('0 von 2 Abfragerichtungen kennengelernt'),
  ).toBeVisible();
  await expect(page.getByLabel('Introduced directions')).toHaveText('0');
  await expect(page.getByLabel('Introduction attempts')).toHaveText('1');

  await expect(field).toBeFocused();
  await field.press('Enter');
  await expect(
    page.getByText('1 von 2 Abfragerichtungen kennengelernt'),
  ).toBeVisible();
  await expect(field).toBeFocused();
  await expect(page.getByLabel('Introduced directions')).toHaveText('1');
  await expect(page.getByLabel('Introduction attempts')).toHaveText('2');
});

test('the learning pass clears a save failure before checking a correction', async ({
  page,
}) => {
  await page.goto('/?state=learn-retry');
  const field = page.getByLabel('Schreib die Antwort');
  await field.fill('memory');
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await field.fill('remember');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(
    page.getByText('Noch nicht ganz. Schreib die Vokabel genau so ab.'),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('');
  await expect(page.getByLabel('Introduction attempts')).toHaveText('1');

  await field.fill('memory');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(
    page.getByText('1 von 2 Abfragerichtungen kennengelernt'),
  ).toBeVisible();
  await expect(page.getByLabel('Introduced directions')).toHaveText('1');
  await expect(page.getByLabel('Introduction attempts')).toHaveText('2');
});
