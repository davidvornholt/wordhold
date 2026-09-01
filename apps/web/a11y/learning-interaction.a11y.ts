import { expect, test } from '@playwright/test';

const reverseDirectionPattern = /Englisch → Deutsch/u;
const forwardDirectionPattern = /Deutsch → Englisch/u;
const mixedDirectionPattern = /Gemischt/u;

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('the learning pass starts in the chosen direction', async ({ page }) => {
  await page.goto('/?state=learn-start');
  await expect(page.getByText('Welche Richtung?')).toBeFocused();
  await expect(
    page.getByRole('radio', { name: mixedDirectionPattern }),
  ).toHaveCount(0);
  await page.getByRole('radio', { name: reverseDirectionPattern }).check();
  await page.getByRole('button', { name: '1 Vokabel kennenlernen' }).click();

  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'learn-native',
  );
  await expect(
    page.getByRole('heading', { level: 2, name: 'to look (at)' }),
  ).toHaveAttribute('lang', 'en');
  await expect(
    page.getByText('Englisch → Deutsch', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Richtung ändern' }),
  ).toHaveCount(0);
});

test('the direction picker still works when preferences cannot be stored', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
    });
  });
  await page.goto('/?state=learn-start');
  await page.getByRole('radio', { name: forwardDirectionPattern }).check();
  await page.getByRole('button', { name: '2 Vokabeln kennenlernen' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'learn');
  await expect(
    page.getByRole('heading', { level: 2, name: 'die Erinnerung' }),
  ).toBeVisible();
});

test('a full learning section offers at most twenty more vocabulary items', async ({
  page,
}) => {
  await page.goto('/?state=learn-section-done');
  const continueLearning = page.getByRole('button', {
    name: 'Weitere 20 Vokabeln kennenlernen · Deutsch → Englisch',
  });

  await expect(continueLearning).toBeVisible();
  await continueLearning.click();
  await expect(page.getByLabel('Continued learning sections')).toHaveText('1');
});

// Nothing in the learning pass is graded, but it does decide which entries the
// scheduler is allowed to ask about, so an entry must not count as met until it
// has actually been written correctly.
test('the learning pass asks again for a wrong copy and records only the correct ones', async ({
  page,
}) => {
  await page.goto('/?state=learn');
  const field = page.getByLabel('Schreib die Antwort');
  const advance = page.getByRole('button', { name: 'Weiter' });
  const progress = page.getByText('von 2 Vokabeln kennengelernt');
  await expect(progress).toHaveText(
    '0 von 2 Vokabeln kennengelernt · Deutsch → Englisch',
  );
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
  await expect(progress).toHaveText(
    '0 von 2 Vokabeln kennengelernt · Deutsch → Englisch',
  );
  await expect(page.getByLabel('Introduced directions')).toHaveText('0');

  await field.fill('Memory');
  await field.press('Enter');
  await expect(progress).toHaveText(
    '1 von 2 Vokabeln kennengelernt · Deutsch → Englisch',
  );
  await expect(field).toBeFocused();
  await expect(field).toHaveAccessibleDescription(
    'die Ferien Vorlage: holiday',
  );
  await expect(field).toHaveAttribute('placeholder', 'holiday');
  await expect(page.getByLabel('Introduced directions')).toHaveText('1');

  await page.getByLabel('Schreib die Antwort').fill('holiday');
  await page.getByLabel('Schreib die Antwort').press('Enter');
  await expect(progress).toHaveText(
    '2 von 2 Vokabeln kennengelernt · Deutsch → Englisch',
  );
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: '2 Vokabeln für Deutsch → Englisch kennengelernt',
    }),
  ).toBeFocused();
  await expect(page.getByLabel('Introduced directions')).toHaveText('2');
  await expect(
    page.getByRole('button', {
      name: '1 Vokabel kennenlernen · Englisch → Deutsch',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Jetzt üben · Deutsch → Englisch',
    }),
  ).toBeVisible();

  await page
    .getByRole('button', {
      name: '1 Vokabel kennenlernen · Englisch → Deutsch',
    })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'to look (at)' }),
  ).toBeVisible();
  await expect(
    page.getByText('0 von 1 Vokabeln kennengelernt · Englisch → Deutsch'),
  ).toBeVisible();
  await expect(page.getByLabel('Introduced directions')).toHaveText('2');

  const reverseField = page.getByLabel('Schreib die Antwort');
  await reverseField.fill('ansehen');
  await reverseField.press('Enter');
  await expect(page.getByLabel('Introduced directions')).toHaveText('3');
});
