import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const unitActionPattern = /kennenlernen$|üben$/u;
const coursePracticePattern = /Karten üben$/u;
const unitPracticePattern = /Vokabeln üben$/u;

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
    page.getByRole('button', { name: '2 Vokabeln kennenlernen' }),
  ).toBeVisible();
});

test('an untouched unit leads with learning and shows its vocabulary inline', async ({
  page,
}) => {
  await page.goto('/?state=unit-unintroduced');
  await expect(
    page.getByRole('button', { name: '12 Vokabeln kennenlernen' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vokabeln' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: unitPracticePattern }),
  ).toHaveCount(0);
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
});
