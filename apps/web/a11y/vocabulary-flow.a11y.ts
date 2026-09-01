import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('the vocabulary library exposes per-direction dates and cross-unit selection', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary');
  await expect(page.getByText('1 von 2 Richtungen geübt')).toBeVisible();
  await page.locator('summary').first().click();
  await expect(page.getByText('Deutsch → Englisch').first()).toBeVisible();
  await expect(page.getByText('Englisch → Deutsch').first()).toBeVisible();
  await expect(page.getByText('nicht gewusst').first()).toBeVisible();
  await expect(page.getByText('That trip is a happy memory.')).toBeVisible();
  await expect(
    page.getByText('Diese Reise ist eine schöne Erinnerung.'),
  ).toBeVisible();
  await expect(
    page.getByText('Noch nicht kennengelernt').first(),
  ).toBeVisible();

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
  const referee = page.getByRole('listitem').filter({
    hasText: 'the referee',
  });
  await referee.locator('summary').click();
  await referee.getByRole('button', { name: 'Beispielsatz erzeugen' }).click();
  await expect(referee.getByRole('status')).toBeFocused();
  await expect(
    referee.getByText('The referee stopped the match.'),
  ).toBeVisible();
  await expect(
    referee.getByText('Der Schiedsrichter unterbrach das Spiel.'),
  ).toBeVisible();
  await expect(referee.getByText('Mit KI erzeugt')).toBeVisible();
});
