import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// A missed card has to come back inside the session. If it leaves instead, it
// sits on FSRS's one-minute relearning step and the dashboard says "Üben" again
// a minute after the session was finished.
test('a missed card returns later and a double click advances only once', async ({
  page,
}) => {
  await page.goto('/?state=practice-session');
  const answer = page.getByLabel('Deine Antwort');
  const progress = page.getByText('von 2 Karten geschafft');
  const check = page.getByRole('button', { name: 'Prüfen' });
  const next = page.getByRole('button', { name: 'Weiter' });
  await expect(progress).toHaveText('0 von 2 Karten geschafft');

  await answer.fill('wrong');
  await check.click();
  await next.dblclick();
  await expect(progress).toHaveText('0 von 2 Karten geschafft');
  await expect(page.getByText('Ferien')).toBeVisible();

  await answer.fill('holiday');
  await check.click();
  await next.click();
  await expect(progress).toHaveText('1 von 2 Karten geschafft');
  await expect(page.getByText('Erinnerung')).toBeVisible();
  await expect(page.getByText('Noch einmal')).toBeVisible();
  await expect(page.getByLabel('Submitted revision')).toHaveText('1');

  await answer.fill('memory');
  await check.click();
  await next.click();
  await expect(progress).toHaveText('2 von 2 Karten geschafft');
  await expect(page.getByText('Sitzung abgeschlossen!')).toBeVisible();
  await expect(
    page.getByText('1 von 2 Karten auf Anhieb richtig, 1 noch einmal geübt.'),
  ).toBeVisible();
});

test('a first-attempt grading failure keeps its stored state in the final summary', async ({
  page,
}) => {
  await page.goto('/?state=practice-session');
  const answer = page.getByLabel('Deine Antwort');
  const check = page.getByRole('button', { name: 'Prüfen' });
  const next = page.getByRole('button', { name: 'Weiter' });

  await answer.fill('ungraded');
  await check.click();
  await next.click();
  await expect(page.getByText('Ferien')).toBeVisible();

  await answer.fill('holiday');
  await check.click();
  await next.click();
  await expect(page.getByText('Sitzung beendet.')).toBeVisible();
  await expect(
    page.getByText(
      '1 Karte konnte nicht bewertet werden. Lernstand und Termin blieben unverändert.',
    ),
  ).toBeVisible();
});

test('a repeated-card grading failure keeps its stored state in the final summary', async ({
  page,
}) => {
  await page.goto('/?state=practice-session');
  const answer = page.getByLabel('Deine Antwort');
  const check = page.getByRole('button', { name: 'Prüfen' });
  const next = page.getByRole('button', { name: 'Weiter' });

  await answer.fill('wrong');
  await check.click();
  await next.click();
  await answer.fill('holiday');
  await check.click();
  await next.click();
  await expect(page.getByText('Noch einmal')).toBeVisible();

  await answer.fill('ungraded');
  await check.click();
  await next.click();
  await expect(page.getByText('Sitzung beendet.')).toBeVisible();
  await expect(
    page.getByText('1 von 2 Karten auf Anhieb richtig.'),
  ).toBeVisible();
  await expect(
    page.getByText(
      '1 Karte konnte nicht bewertet werden. Lernstand und Termin blieben unverändert.',
    ),
  ).toBeVisible();
});

test('an ungraded future drill card keeps its existing date in the summary', async ({
  page,
}) => {
  await page.goto('/?state=drill-session');
  await page.getByLabel('Deine Antwort').fill('ungraded');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(page.getByText('Sitzung beendet.')).toBeVisible();
  await expect(
    page.getByText(
      '1 Karte konnte nicht bewertet werden. Lernstand und Termin blieben unverändert.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText('1 Karte konnte nicht bewertet werden und bleibt fällig.'),
  ).toHaveCount(0);
});
