import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';
import { fixtureStates } from './fixture-state';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const imageAltViolationPattern = /image-alt/u;

for (const state of fixtureStates) {
  test(`${state} renders its intended state without Axe violations`, async ({
    page,
  }) => {
    const response = await page.goto(`/?state=${state}`);
    expect(response?.ok()).toBe(true);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('body')).toHaveAttribute('data-fixture', state);
    assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  });
}

test('authenticated routes remain reachable through their user transitions', async ({
  page,
}) => {
  await page.goto('/?state=signed-out');
  await page.getByRole('button', { name: 'Mit GitHub anmelden' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'dashboard',
  );

  await page.getByRole('button', { name: 'Seite fotografieren' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'import');
  await page.getByLabel('Foto der Vokabelseite').setInputFiles({
    name: 'page.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fixture'),
  });
  await page.getByRole('button', { name: 'Hochladen und auslesen' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'verification',
  );
  await page.getByRole('button', { name: '1 Einträge importieren' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'dashboard',
  );

  await page.getByRole('button', { name: 'Lernen' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'learn-units',
  );
  await page.getByRole('button', { name: '2 lernen' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'learn');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'dashboard',
  );

  // Exact, because the card also offers "Einheit üben" next to it.
  await page.getByRole('button', { name: 'Üben', exact: true }).click();
  await page.getByLabel('Deine Antwort').fill('wrong');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'practice-feedback',
  );
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'practice-empty',
  );
});

test('dependency-failure recovery returns to the authenticated dashboard', async ({
  page,
}) => {
  await page.goto('/?state=error');
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'dashboard',
  );
});

test('the gate rejects a real violation injected only for this scan', async ({
  page,
}) => {
  await page.goto('/?state=signed-out');
  await page.evaluate(() => {
    const image = document.createElement('img');
    image.src =
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
    document.querySelector('main')?.append(image);
  });
  const violations = await scanWcag22AaViolations(page);
  expect(violations.map((violation) => violation.id)).toContain('image-alt');
  expect(() => assertNoAccessibilityViolations(violations)).toThrow(
    imageAltViolationPattern,
  );
});
