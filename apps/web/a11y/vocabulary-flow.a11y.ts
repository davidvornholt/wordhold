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
  await expect(memory.getByText('Deutsch → Englisch')).toBeVisible();
  await expect(memory.getByText('Englisch → Deutsch')).toBeVisible();
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

test('difficult vocabulary can be selected as one practice set', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary-difficult');
  await page
    .getByRole('button', { name: 'Schwierige Vokabeln auswählen' })
    .click();
  await expect(page.getByText('1 Vokabel ausgewählt')).toBeVisible();
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
