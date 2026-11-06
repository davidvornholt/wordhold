import { expect, test } from '@playwright/test';

// Either text comes from React's response to the click: the first while the
// browser asks for a passkey, the second once it has refused.
const clickResponse =
  /Warte auf deinen Passkey|Die Anmeldung hat nicht geklappt/u;

test('the production sign-in page responds to input', async ({ page }) => {
  const pageErrors: Array<string> = [];
  page.on('pageerror', (error) => {
    pageErrors.push(`${error.name}: ${error.message}`);
  });

  await page.goto('/');

  const signIn = page.getByRole('button', { name: 'Mit Passkey anmelden' });
  const response = page.getByText(clickResponse);

  // The server renders the button, so seeing it proves nothing about the
  // bundle. A click that lands before hydration is lost, so it is retried.
  await expect(async () => {
    expect(pageErrors).toEqual([]);
    if (!(await response.isVisible())) {
      await signIn.click({ timeout: 1000 });
    }
    await expect(response).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });

  expect(pageErrors).toEqual([]);
});
