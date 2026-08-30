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

  // The dashboard card holds nothing but the course name and today's practice;
  // importing, units and settings are reached through the course page.
  await page.getByRole('button', { name: 'English A2' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'course');
  await page.getByRole('button', { name: 'Seite fotografieren' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'import');
  await page.getByLabel('Fotos auswählen').setInputFiles([
    {
      name: 'page-1.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fixture one'),
    },
    {
      name: 'page-2.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fixture two'),
    },
  ]);
  await expect(page.getByText('2 Fotos ausgewählt')).toBeVisible();
  await page
    .getByRole('button', { name: '2 Seiten hochladen und auslesen' })
    .click();
  await expect(page.getByText('2 von 2 Seiten verarbeitet')).toBeVisible();
  await page.getByRole('button', { name: 'Stapel prüfen' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'import-session',
  );
  await page.getByRole('button', { name: 'Mit Seite 1 beginnen' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'verification-batch-first',
  );
  await page
    .getByRole('button', { name: '12 Einträge importieren und weiter' })
    .click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'verification-batch-second',
  );
  await page.getByRole('button', { name: '12 Einträge importieren' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'verification-batch-complete',
  );
  await page
    .getByRole('button', { name: 'Zum Seitenstapel', exact: true })
    .click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'import-session',
  );
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'dashboard',
  );

  await page.getByRole('button', { name: 'English A2' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'course');
  await page.getByRole('button', { name: 'Unit 3 – Holidays' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'unit');
  await page.getByRole('button', { name: '2 kennenlernen' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'learn');
  await page.getByRole('button', { name: 'Unit 3 – Holidays' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'unit');
  await page.getByRole('button', { name: 'English A2' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'course');
  await page.getByRole('button', { name: 'Übersicht' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'dashboard',
  );

  await page.getByRole('button', { name: '6 Karten üben' }).click();
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

test('capture keeps a batch open while a page upload has failed', async ({
  page,
}) => {
  await page.goto('/?state=import-failed');
  await expect(page.getByRole('button', { name: 'Stapel prüfen' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Erneut versuchen' }),
  ).toBeVisible();
});

test('batch review requires every page in order', async ({ page }) => {
  await page.goto('/?state=verification-batch-first');
  await expect(
    page.getByRole('button', { name: 'Diese Seite später prüfen' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Seite 1 von 2' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '12 Einträge importieren und weiter' })
    .click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'verification-batch-second',
  );
  await expect(
    page.getByRole('heading', { name: 'Seite 2 von 2' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '12 Einträge importieren' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'verification-batch-complete',
  );
  await expect(page.getByText('2 Seiten wurden importiert.')).toBeVisible();
});

test('leaving an individual page returns to its import stack', async ({
  page,
}) => {
  await page.goto('/?state=verification-batch-first');
  await page.getByRole('button', { name: 'Zum Seitenstapel' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'import-session',
  );
  await expect(
    page.getByRole('heading', { name: 'Seiten im Stapel' }),
  ).toBeVisible();
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
