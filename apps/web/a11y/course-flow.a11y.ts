import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const unitActionPattern = /kennenlernen$|üben$/u;
const coursePracticePattern = /Karten üben$/u;

test('the course offers practice when its queue has work', async ({ page }) => {
  await page.goto('/?state=course');
  await expect(
    page.getByRole('button', { name: '6 Karten üben' }),
  ).toBeVisible();
});

test('the course hides practice when its queue has no work', async ({
  page,
}) => {
  await page.goto('/?state=course-no-practice');
  await expect(
    page.getByRole('button', { name: coursePracticePattern }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Seite fotografieren' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Einstellungen' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      exact: true,
      name: '2 Vokabeln kennenlernen',
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: '2 Vokabeln kennenlernen · Englisch → Deutsch',
    }),
  ).toBeVisible();
});

test('a course with only empty units still leads into importing vocabulary', async ({
  page,
}) => {
  await page.goto('/?state=course-empty-units');
  await expect(
    page.getByRole('button', { name: 'Seite fotografieren' }),
  ).toBeVisible();
  await expect(page.getByText('Für jetzt geschafft')).toHaveCount(0);
  await expect(page.getByText('Noch keine Vokabeln')).toBeVisible();
});

test('an untouched unit exposes both learning paths before the session', async ({
  page,
}) => {
  await page.goto('/?state=unit-unintroduced');
  await expect(
    page.getByRole('heading', { name: 'Lernstand nach Richtung' }),
  ).toBeVisible();
  await expect(page.getByText('Deutsch → Englisch 0/25')).toBeVisible();
  await expect(page.getByText('Englisch → Deutsch 0/25')).toBeVisible();
  await expect(page.getByText('25 Vokabeln noch kennenlernen')).toBeVisible();
  await expect(page.getByText('Für jetzt geschafft')).toHaveCount(0);
  await expect(page.getByText('Als Nächstes')).toHaveCount(0);
  const forwardPath = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Deutsch → Englisch' }) });
  const reversePath = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Englisch → Deutsch' }) });
  await expect(
    forwardPath.getByRole('button', {
      exact: true,
      name: '20 Vokabeln kennenlernen',
    }),
  ).toBeVisible();
  await expect(
    reversePath.getByRole('button', {
      exact: true,
      name: '20 Vokabeln kennenlernen',
    }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vokabeln' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Alle auswählen' }).check();
  await expect(page.getByText('25 Vokabeln ausgewählt')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Auswahl kennenlernen' }),
  ).toBeVisible();
});

test('a partly learned unit explains why only one path still needs learning', async ({
  page,
}) => {
  await page.goto('/?state=unit');
  await expect(page.getByText('Deutsch → Englisch 18/18')).toBeVisible();
  await expect(page.getByText('Englisch → Deutsch 16/18')).toBeVisible();
  const reversePath = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Englisch → Deutsch' }) });
  await expect(page.getByText('Als Nächstes')).toBeVisible();
  const recommendedAction = page.getByRole('button', {
    name: '2 Vokabeln kennenlernen · Englisch → Deutsch',
  });
  await expect(recommendedAction).toBeVisible();
  await expect(
    reversePath.getByRole('button', {
      exact: true,
      name: '2 Vokabeln kennenlernen',
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('listitem').getByRole('button', {
      exact: true,
      name: '2 Vokabeln kennenlernen',
    }),
  ).toHaveCount(0);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});

test('a due unit keeps scheduled work separate from custom selection', async ({
  page,
}) => {
  await page.goto('/?state=unit-due');
  await expect(page.getByText('Als Nächstes')).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: '1 Karte üben · Deutsch → Englisch',
    }),
  ).toBeVisible();
});

test('empty units do not claim to be learned or offer work', async ({
  page,
}) => {
  await page.goto('/?state=course');
  const emptyUnit = page
    .getByRole('listitem')
    .filter({ hasText: 'Unit 5 – Empty' });
  await expect(emptyUnit.getByText('Noch keine Vokabeln')).toBeVisible();
  await expect(emptyUnit.getByText('alle kennengelernt')).toHaveCount(0);

  await page.goto('/?state=unit-empty');
  await expect(page.getByText('Noch keine Vokabeln')).toBeVisible();
  await expect(page.getByText('alle kennengelernt')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: unitActionPattern }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Vokabeln hinzufügen' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Seite fotografieren' }),
  ).toBeVisible();
  await expect(page.getByLabel('Vokabel suchen')).toHaveCount(0);
});
