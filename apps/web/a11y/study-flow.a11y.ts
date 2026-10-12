import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

const forwardDirectionPattern = /Deutsch → Englisch/u;
const cardStartPattern = /Karten? starten/u;
const studyActionPattern = /^Auswahl /u;

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// The night-before path: the course page leads through the book into a unit
// page that carries the unit's actions and its vocabulary as one selectable
// list.
test('selected practice reaches a unit sitting through the course page', async ({
  page,
}) => {
  await page.goto('/?state=dashboard');
  await page.getByRole('button', { name: 'English A2' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'course');

  await page.getByRole('button', { name: 'Green Line 3' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-fixture', 'book');
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

// Practice asks only what has been learned or skipped, so the selection
// offers learning first while any of it is still open.
test('a selection offers learning what is open before practising what is learned', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary');
  const learn = page.getByRole('button', {
    exact: true,
    name: 'Auswahl kennenlernen',
  });
  const practise = page.getByRole('button', {
    exact: true,
    name: 'Auswahl üben',
  });
  await page.getByLabel('the referee auswählen').check();
  await expect(practise).toBeVisible();
  await expect(learn).toHaveCount(0);

  // memory is still to be learned from English into German.
  await page.getByLabel('memory auswählen').check();
  await expect(
    page.getByRole('button', { name: studyActionPattern }),
  ).toHaveText(['Auswahl kennenlernen', 'Auswahl üben']);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await page
    .getByRole('button', { exact: true, name: 'Kennenlernen überspringen' })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Kennenlernen überspringen',
  });
  await dialog
    .getByRole('button', {
      name: '1 Vokabel überspringen · Englisch → Deutsch',
    })
    .click();
  await dialog.getByRole('button', { name: 'Fertig' }).click();
  await expect(learn).toHaveCount(0);
  await expect(practise).toBeVisible();
});

test('a selection with nothing learned yet offers only learning', async ({
  page,
}) => {
  await page.goto('/?state=terms-course');
  await page.getByLabel('Enzym auswählen').check();
  await expect(
    page.getByRole('button', { exact: true, name: 'Auswahl kennenlernen' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { exact: true, name: 'Auswahl üben' }),
  ).toHaveCount(0);
});

test('practice of a partly learned selection says what it leaves out', async ({
  page,
}) => {
  await page.goto('/?state=study-start-unlearned');
  await expect(
    page.getByText(
      '1 Karte dieser Auswahl hast du noch nicht kennengelernt. Abgefragt wird nur, was du schon kennengelernt oder übersprungen hast.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '← Vokabelliste' }),
  ).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await page.getByRole('button', { name: 'Auswahl kennenlernen' }).click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'learn-start',
  );
});
