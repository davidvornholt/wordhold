import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('a typed code is shown for comparison and approving signs the command in', async ({
  page,
}) => {
  await page.goto('/?state=device-entry');

  await page
    .getByRole('textbox', { name: 'Code aus dem Terminal' })
    .fill(' wxyz7k3p ');
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(page.getByText('WXYZ7K3P', { exact: true })).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await page.getByRole('button', { name: 'Anmeldung bestätigen' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Der Befehl ist angemeldet. Du kannst diesen Tab schließen und zum Terminal zurückkehren.',
  );
  await expect(
    page.getByRole('button', { name: 'Anmeldung bestätigen' }),
  ).toHaveCount(0);
});

test('denying leaves the command signed out', async ({ page }) => {
  await page.goto('/?state=device');

  await page.getByRole('button', { name: 'Ablehnen' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Du hast die Anmeldung abgelehnt. Der Befehl bleibt abgemeldet.',
  );
});

test('an unknown or expired code asks for a new login', async ({ page }) => {
  await page.goto('/?state=device-entry');

  await page
    .getByRole('textbox', { name: 'Code aus dem Terminal' })
    .fill('XXXXXXXX');
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(
    page.getByText('Diesen Code gibt es nicht oder er ist abgelaufen.', {
      exact: false,
    }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
