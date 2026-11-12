import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

const holidaysPattern = /Unit 3 – Holidays/u;
const openHolidaysPattern = /^Einzeln wählen \(.*Unit 3 – Holidays\)$/u;
const beachPattern = /^beach/u;
const switchedOffPattern = /In den Einstellungen ausgeschaltet/u;
const givenUpPattern = /^abgebrochen/u;
const underwayPattern = /^läuft/u;

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// A test covers whole units, with single words left out after opening one.
test('a test is put together from a unit without one of its words', async ({
  page,
}) => {
  await page.goto('/?state=exams');
  await page.getByRole('button', { name: 'Test anlegen' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'exam-new',
  );
  // The course learns only one way round, but the test asks both.
  await expect(page.getByText(switchedOffPattern)).toBeVisible();

  const holidays = page.getByRole('checkbox', { name: holidaysPattern });
  await holidays.check();
  await expect(page.getByText('4 ausgewählt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: openHolidaysPattern }).click();
  await page.getByRole('checkbox', { name: beachPattern }).uncheck();
  await expect(holidays).toHaveAttribute('aria-checked', 'mixed');
  await expect(page.getByText('3 ausgewählt', { exact: true })).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  const save = page.getByRole('button', { name: 'Test anlegen' });
  await save.click();
  await expect(page.getByText('Gib dem Test einen Namen.')).toBeVisible();
  await page.getByLabel('Name').fill('Vokabeltest Unit 3');
  await save.click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'exam-fresh',
  );
});

// The standing is numbers only: the last round, the change, and the cards
// right twice. A given-up round stays in the history.
test('a test shows its standing and its rounds', async ({ page }) => {
  await page.goto('/?state=exam');
  await expect(page.getByText('83 %', { exact: true })).toBeVisible();
  await expect(
    page.getByText('25 Prozentpunkte besser als davor', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Zweimal hintereinander richtig')).toBeVisible();
  await expect(page.getByText(givenUpPattern)).toBeVisible();
  await expect(page.getByText(underwayPattern)).toBeVisible();
  await page.getByRole('button', { name: 'Diese Fehler üben' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'study-session',
  );
});
