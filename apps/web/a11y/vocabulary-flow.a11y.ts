import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('the vocabulary library exposes per-direction dates and cross-unit selection', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary');
  await expect(page.getByText('1 von 2 Richtungen geübt')).toBeVisible();
  const open = page.getByRole('button', { exact: true, name: 'memory' });
  await open.click();
  const memory = page.getByRole('dialog', { name: 'memory' });
  await expect(memory.getByText('die Erinnerung')).toBeVisible();
  await expect(
    memory.getByText('Deutsch → Englisch', { exact: true }),
  ).toBeVisible();
  await expect(
    memory.getByText('Englisch → Deutsch', { exact: true }),
  ).toBeVisible();
  await expect(memory.getByText('2× nicht gewusst')).toBeVisible();
  await expect(memory.getByText('Noch nicht kennengelernt')).toBeVisible();
  await expect(memory.getByText('That trip is a happy memory.')).toBeVisible();
  await expect(
    memory.getByText('Diese Reise ist eine schöne Erinnerung.'),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await page.keyboard.press('Escape');
  await expect(memory).toBeHidden();
  await expect(open).toBeFocused();

  await page.getByLabel('memory auswählen').check();
  await page.getByLabel('the referee auswählen').check();
  await expect(page.getByText('2 Vokabeln ausgewählt')).toBeVisible();
  await page.getByRole('button', { name: 'Auswahl üben' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'study-start',
  );
});

test('selected words already met can be practised in their example sentences', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary');
  await page.getByLabel('memory auswählen').check();
  const sentences = page.getByRole('button', { name: 'Sätze übersetzen' });
  await expect(sentences).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await sentences.click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'sentence-practice',
  );
});

test('difficult vocabulary lists the most often missed first and can be selected as one practice set', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary-difficult');
  const words = page.getByRole('button', {
    exact: true,
    name: /^(adolescent|memory)$/,
  });
  await expect(words).toHaveText(['memory', 'adolescent']);
  await expect(page.getByText('· 2× nicht gewusst')).toBeVisible();
  await expect(page.getByText('· 1× fast richtig')).toBeVisible();
  await expect(
    page.getByRole('button', { exact: true, name: 'the referee' }),
  ).toBeHidden();
  await page
    .getByRole('button', { name: 'Schwierige Vokabeln auswählen' })
    .click();
  await expect(page.getByText('2 Vokabeln ausgewählt')).toBeVisible();
});

test('vocabulary with spelling pitfalls is listed with them, found for words that had none', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary-pitfalls');
  await expect(
    page.getByText('Das c hört man nicht, wie in adolescence.'),
  ).toBeVisible();
  await expect(page.getByText('Stolperstellen werden gesucht')).toBeHidden();
  await expect(
    page.getByRole('button', { exact: true, name: 'memory' }),
  ).toBeHidden();
  await expect(
    page.getByRole('button', { exact: true, name: 'the referee' }),
  ).toBeHidden();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await page.getByRole('button', { exact: true, name: 'adolescent' }).click();
  const adolescent = page.getByRole('dialog', { name: 'adolescent' });
  await expect(
    adolescent.getByText('Das c hört man nicht, wie in adolescence.'),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  await page
    .getByRole('button', { name: 'Vokabeln mit Stolperstellen auswählen' })
    .click();
  await expect(page.getByText('1 Vokabel ausgewählt')).toBeVisible();
  await page.getByLabel('Anzeigen').selectOption('Alle');
  await expect(page.getByText('Stolperstelle', { exact: true })).toBeHidden();
});

test('a missing vocabulary example can be generated from its details', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary');
  await page.getByRole('button', { exact: true, name: 'the referee' }).click();
  const referee = page.getByRole('dialog', { name: 'the referee' });
  await referee.getByRole('button', { name: 'Beispielsatz erzeugen' }).click();
  await expect(
    referee
      .getByRole('status')
      .filter({ hasText: 'The referee stopped the match.' }),
  ).toBeFocused();
  await expect(
    referee.getByText('The referee stopped the match.'),
  ).toBeVisible();
  await expect(
    referee.getByText('Der Schiedsrichter unterbrach das Spiel.'),
  ).toBeVisible();
  await expect(referee.getByText('Mit KI erzeugt')).toBeVisible();
});
