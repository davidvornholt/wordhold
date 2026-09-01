import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('a running sitting keeps the direction fixed', async ({ page }) => {
  await page.goto('/?state=practice-session');
  await expect(
    page.getByRole('button', { name: 'Richtung ändern' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { exact: true, name: '← Übersicht' }),
  ).toHaveCount(1);
  await expect(
    page.getByRole('button', { exact: true, name: 'Zurück zur Übersicht' }),
  ).toHaveCount(0);
});

test('a missed card returns in the end-of-section after-round', async ({
  page,
}) => {
  await page.goto('/?state=practice-session');
  const answer = page.getByLabel('Deine Antwort');
  await expect(page.getByText('0 von 2 Karten bearbeitet')).toBeVisible();

  await answer.fill('wrong');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByText('Noch nicht sicher')).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).dblclick();
  await expect(page.getByText('1 von 2 Karten bearbeitet')).toBeVisible();
  await expect(answer).toBeFocused();

  await answer.fill('holiday');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(page.getByText('Nachrunde', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Erinnerung' }),
  ).toBeVisible();
  await expect(answer).toBeFocused();
  await expect(
    page.getByText('Übersetze auf Englisch · Noch einmal'),
  ).toBeVisible();

  await answer.fill('memory');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Für jetzt geschafft' }),
  ).toBeFocused();
  await expect(page.getByText('2 von 2 Karten')).toBeVisible();
  await expect(page.getByText('Nach Fehlern richtig')).toBeVisible();
  await expect(page.getByText('Weiterhin unsicher')).toHaveCount(0);
});

test('an unknown card reveals its solution and returns in the after-round', async ({
  page,
}) => {
  await page.goto('/?state=practice-session');
  const answer = page.getByLabel('Deine Antwort');
  await expect(answer).toBeFocused();

  await page.getByRole('button', { name: 'Weiß ich nicht' }).click();
  await expect(page.getByText('Nicht gewusst')).toBeVisible();
  await expect(page.getByText('Erwartet: memory')).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('1 von 2 Karten bearbeitet')).toBeVisible();

  await answer.fill('holiday');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(page.getByText('Nachrunde', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Erinnerung' }),
  ).toBeVisible();
});

test('a rejected typo can be stored as Hard without teaching it as an answer', async ({
  page,
}) => {
  await page.goto('/?state=practice-session');
  const answer = page.getByLabel('Deine Antwort');

  await answer.fill('memroy');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByText('Noch nicht sicher')).toBeVisible();
  await expect(
    page.getByText('wird aber nicht als Lösung gespeichert', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Als richtig werten' }).click();

  await expect(
    page.getByRole('heading', { level: 2, name: 'Ferien' }),
  ).toBeVisible();
  await expect(page.getByText('1 von 2 Karten bearbeitet')).toBeVisible();
  await expect(answer).toBeFocused();
});

test('an unavailable judge leaves schedule and summary intact', async ({
  page,
}) => {
  await page.goto('/?state=practice-session');
  await page.getByLabel('Deine Antwort').fill('ungraded');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByLabel('Deine Antwort').fill('holiday');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('2 von 2 Karten')).toBeVisible();
  await expect(
    page.getByText(
      '1 Karte konnte nicht bewertet werden. Lernstand und Termin blieben unverändert.',
    ),
  ).toBeVisible();
});

test('an ungraded future custom-practice card keeps its existing date', async ({
  page,
}) => {
  await page.goto('/?state=study-session');
  await page.getByLabel('Deine Antwort').fill('ungraded');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('Für jetzt geschafft')).toBeVisible();
  await expect(
    page.getByText(
      '1 Karte konnte nicht bewertet werden. Lernstand und Termin blieben unverändert.',
    ),
  ).toBeVisible();
});

test('one-card progress and summary use the singular label', async ({
  page,
}) => {
  await page.goto('/?state=practice');
  await expect(page.getByText('0 von 1 Karte bearbeitet')).toBeVisible();

  await page.goto('/?state=practice-complete-one-card');
  await expect(page.getByText('1 von 1 Karte')).toBeVisible();
  await expect(page.getByText('Jetzt fällig')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Weiter üben' })).toBeVisible();

  await page.goto('/?state=practice-ungraded-one-card');
  await expect(page.getByText('1 von 1 Karte')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Weiter üben' })).toHaveCount(
    0,
  );
});
