import { expect, test } from '@playwright/test';

const forwardDirectionPattern = /Deutsch → Englisch/u;
const cardStartPattern = /Karten? starten/u;

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// The night-before path: the course page leads into a unit page that carries
// the unit's actions and its vocabulary as one selectable list.
test('selected practice reaches a unit sitting through the course page', async ({
  page,
}) => {
  await page.goto('/?state=dashboard');
  await page.getByRole('button', { name: 'English A2' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'course');

  await page.getByRole('button', { name: 'Unit 3 – Holidays' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'unit');
  await expect(page.getByRole('heading', { name: 'Vokabeln' })).toBeVisible();
  await expect(page.getByText('memory')).toBeVisible();

  const selectAll = page.getByRole('checkbox', { name: 'Alle auswählen' });
  await page.getByLabel('memory auswählen').check();
  await expect(selectAll).toHaveAttribute('aria-checked', 'mixed');
  await expect
    .poll(() =>
      selectAll.evaluate(
        (control) => (control as HTMLInputElement).indeterminate,
      ),
    )
    .toBe(true);
  await selectAll.check();
  await expect(page.getByText('2 Vokabeln ausgewählt')).toBeVisible();
  await page.getByRole('button', { name: 'Auswahl üben' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'study-start',
  );
  await page.getByRole('radio', { name: forwardDirectionPattern }).check();
  await page.getByRole('button', { name: '16 Karten starten' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'study-session',
  );
});

test('an explicit selection of new vocabulary enters the learning pass', async ({
  page,
}) => {
  await page.goto('/?state=unit-unintroduced');
  const forwardPath = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: 'Deutsch → Englisch' }) });
  await expect(
    forwardPath.getByRole('button', {
      exact: true,
      name: '20 Vokabeln kennenlernen',
    }),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'Alle auswählen' }).check();
  await expect(page.getByText('25 Vokabeln ausgewählt')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Auswahl kennenlernen' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Auswahl kennenlernen' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'learn-start',
  );
  await expect(
    page.getByRole('button', { name: cardStartPattern }),
  ).toHaveCount(0);
  await page.getByRole('radio', { name: forwardDirectionPattern }).check();
  await expect(
    page.getByRole('button', { name: '2 Vokabeln kennenlernen' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '2 Vokabeln kennenlernen' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'learn');
  await expect(page.getByLabel('Schreib die Antwort')).toBeVisible();
});
