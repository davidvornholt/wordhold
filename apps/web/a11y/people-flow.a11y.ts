import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const recoveryNotePattern = /Der neue Passkey ersetzt alle bisherigen/u;

test('an invitation shows its link once and lists the person as pending', async ({
  page,
}) => {
  await page.goto('/?state=people');

  await page.getByRole('textbox', { name: 'Name' }).fill('Emil');
  await page
    .getByRole('button', { name: 'Einladung erstellen', exact: true })
    .click();

  const heading = page.getByRole('heading', { name: 'Einladung für Emil' });
  await expect(heading).toBeFocused();
  await expect(
    page.getByRole('textbox', { name: 'Link zum Einrichten' }),
  ).toHaveValue(
    'https://wordhold.example/join#pX8f2LqZr4Tn7VbW1cYk9HsD3mJa6UeG0oRiQyNt5Ew',
  );
  const emil = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'Emil', exact: true }),
  });
  await expect(emil.getByText('Wartet auf die Einrichtung')).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await page.getByRole('button', { name: 'Ausblenden' }).click();
  await expect(heading).toHaveCount(0);
});

test('the administrator recovers, suspends and deletes accounts', async ({
  page,
}) => {
  await page.goto('/?state=people');
  const row = (name: string) =>
    page.getByRole('listitem').filter({
      has: page.getByRole('heading', { level: 3, name, exact: true }),
    });

  await row('Anna')
    .getByRole('button', { name: 'Wiederherstellungscode erstellen' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Wiederherstellungscode für Anna' }),
  ).toBeFocused();
  await expect(page.getByText(recoveryNotePattern)).toBeVisible();

  // A suspension withdraws the code, so its link disappears with it.
  await row('Anna').getByRole('button', { name: 'Zugang sperren' }).click();
  await expect(row('Anna').getByText('Gesperrt')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Wiederherstellungscode für Anna' }),
  ).toHaveCount(0);
  await expect(
    row('Anna').getByRole('button', { name: 'Zugang freigeben' }),
  ).toBeVisible();

  await row('Clara').getByRole('button', { name: 'Löschen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Clara löschen?' });
  await expect(
    dialog.getByRole('button', { name: 'Endgültig löschen' }),
  ).toBeFocused();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await dialog.getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(row('Clara')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Personen' }),
  ).toBeFocused();

  // The administrator's own account is managed through GitHub.
  await expect(row('David').getByRole('button')).toHaveCount(0);
});

test('the administrator opens a person’s progress without practice actions', async ({
  page,
}) => {
  await page.goto('/?state=people');
  await page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Anna', exact: true }) })
    .getByRole('button', { name: 'Lernstand ansehen' })
    .click();

  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'people-progress',
  );
  await expect(
    page.getByRole('heading', { level: 1, name: 'Lernstand von Anna' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Englisch' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Biologie' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jetzt üben' })).toHaveCount(0);
});
