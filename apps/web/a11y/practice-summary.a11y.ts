import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('a one-card session uses the singular progress label', async ({
  page,
}) => {
  await page.goto('/?state=practice');
  await expect(page.getByText('0 von 1 Karte bearbeitet')).toBeVisible();
  await expect(page.getByText('0 von 1 Karten bearbeitet')).toHaveCount(0);
});

test('a completed one-card session uses the singular summary label', async ({
  page,
}) => {
  await page.goto('/?state=practice-complete-one-card');
  const heading = page.getByRole('heading', {
    level: 2,
    name: 'Für jetzt geschafft',
  });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByText('1 von 1 Karte', { exact: true })).toBeVisible();
  await expect(page.getByText('1 von 1 Karten', { exact: true })).toHaveCount(
    0,
  );
});

test('an ungraded one-card session uses the singular summary label', async ({
  page,
}) => {
  await page.goto('/?state=practice-ungraded-one-card');
  const heading = page.getByRole('heading', {
    level: 2,
    name: 'Für jetzt geschafft',
  });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByText('1 von 1 Karte', { exact: true })).toBeVisible();
  await expect(page.getByText('1 von 1 Karten', { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText(
      '1 Karte konnte nicht bewertet werden. Lernstand und Termin blieben unverändert.',
    ),
  ).toBeVisible();
});
