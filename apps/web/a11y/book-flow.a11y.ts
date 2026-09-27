import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// Playwright's Page type reaches this file only through the test fixtures.
type Page = Parameters<Parameters<typeof test>[2]>[0]['page'];

const status = (page: Page) =>
  page.getByRole('status', { name: 'Status beim Eintragen einer Vokabel' });
// Exact names: the direction progress bars are also labelled with "Englisch".
const targetField = (page: Page) =>
  page.getByRole('textbox', { exact: true, name: 'Englisch' });
const nativeField = (page: Page) =>
  page.getByRole('textbox', { exact: true, name: 'Deutsch' });

const typeWord = async (page: Page, target: string, native: string) => {
  await targetField(page).fill(target);
  await nativeField(page).fill(native);
  await nativeField(page).press('Enter');
  await expect(status(page)).toHaveText(`„${target}“ eingetragen.`);
};

test('the course lists its books, and each book leads to its words and units', async ({
  page,
}) => {
  await page.goto('/?state=course');
  await expect(
    page.getByText('Englisch · 71 Vokabeln · 32 noch kennenlernen'),
  ).toBeVisible();
  const textbook = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: 'Green Line 3' }) });
  await expect(textbook).toContainText(
    '3 Einheiten · 43 Vokabeln · 27 noch kennenlernen',
  );
  const novel = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: 'The Hobbit' }) });
  await expect(novel).toContainText('12 Vokabeln · 5 noch kennenlernen');
  // Units live on their book's page.
  await expect(
    page.getByRole('button', { name: 'Unit 3 – Holidays' }),
  ).toHaveCount(0);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await page.getByRole('button', { name: 'The Hobbit' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'book-novel',
  );
});

test('a word typed on the course page goes where the last word went', async ({
  page,
}) => {
  await page.goto('/?state=course');
  const toggle = page.getByRole('button', { name: 'Vokabel eintragen' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  const place = page.getByLabel('Eintragen in');
  await expect(place.locator('option:checked')).toHaveText('The Hobbit');
  await expect(targetField(page)).toBeFocused();
  await typeWord(page, 'wizard', 'der Zauberer');
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await place.selectOption({ label: 'Green Line 3 · Unit 3 – Holidays' });
  await typeWord(page, 'suitcase', 'der Koffer');
  await expect(place.locator('option:checked')).toHaveText(
    'Green Line 3 · Unit 3 – Holidays',
  );

  await page.getByRole('button', { name: 'Fertig' }).click();
  await expect(place).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Vokabel eintragen' }),
  ).toBeFocused();
});

test('a novel keeps its words in the book, without units', async ({ page }) => {
  await page.goto('/?state=book-novel');
  await expect(
    page.getByRole('heading', { level: 1, name: 'The Hobbit' }),
  ).toBeVisible();
  await expect(
    page.getByText('12 Vokabeln · 5 noch kennenlernen'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Einheiten' })).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: '5 Vokabeln kennenlernen · Englisch → Deutsch',
    }),
  ).toBeVisible();
  await expect(page.getByLabel('burglar auswählen')).toBeVisible();

  await page.getByRole('button', { name: 'Vokabel eintragen' }).click();
  await typeWord(page, 'wizard', 'der Zauberer');
  await expect(page.getByLabel('wizard auswählen')).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('a textbook without words of its own lists its units', async ({
  page,
}) => {
  await page.goto('/?state=book');
  await expect(
    page.getByText('3 Einheiten · 43 Vokabeln · 27 noch kennenlernen'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { exact: true, name: 'Vokabeln' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Seite fotografieren' }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await page.getByRole('button', { name: 'Unit 3 – Holidays' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'unit');
  await page.getByRole('button', { name: 'Green Line 3' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'book');
});
