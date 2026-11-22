import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// Overruling a typo does not store it as another answer.
const overruleConsequence = /nicht als weitere Lösung/u;
// Not every screen reader reads a placeholder, so the word to write out,
// which stands in the field until typing starts, is also its description.
const retypeTemplate = /Vorlage: memory/u;

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
  // A mistake is written out before the card moves on, as when learning it.
  const retype = page.getByLabel('Schreib die Antwort ab');
  await expect(retype).toBeFocused();
  await expect(retype).toHaveAccessibleDescription(retypeTemplate);
  const next = page.getByRole('button', { name: 'Weiter' });
  await expect(next).toBeDisabled();
  await retype.fill('memorie');
  await next.click();
  await expect(
    page.getByText('Noch nicht ganz. Schreib die Vokabel genau so ab.'),
  ).toBeVisible();
  await expect(retype).toHaveValue('');
  await expect(retype).toBeFocused();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await retype.fill('memory');
  await retype.press('Enter');
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

test('a learned alternative still shows the book answer', async ({ page }) => {
  await page.goto('/?state=practice-session');
  await page.getByLabel('Deine Antwort').fill('recollection');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByText('Richtig', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Im Buch: memory');
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
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
  await page.getByLabel('Schreib die Antwort ab').fill('memory');
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

// Wider than a phone's answer line, in the fixture's phrase=true session.
const longPhrase = 'to take something into consideration';

for (const width of [320, 360, 390]) {
  test(`a missed phrase shows whole before it is copied, ${width} px wide`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/?state=practice-session&phrase=true');
    await page.getByRole('button', { name: 'Weiß ich nicht' }).click();
    const retype = page.getByLabel('Schreib die Antwort ab');
    await expect(retype).toBeFocused();
    await expect(retype).toHaveAttribute('placeholder', longPhrase);
    // The phrase stands in the field only as its placeholder, which is drawn
    // in the field's own type and box. Written into the field for a moment,
    // it has to fit without scrolling, or the placeholder is cut off.
    const overflow = await retype.evaluate((field: HTMLTextAreaElement) => {
      field.value = field.placeholder;
      const hidden = {
        across: field.scrollWidth - field.clientWidth,
        down: field.scrollHeight - field.clientHeight,
      };
      field.value = '';
      return hidden;
    });
    expect(overflow).toEqual({ across: 0, down: 0 });
  });
}

test('a rejected typo can be stored as Hard without teaching it as an answer', async ({
  page,
}) => {
  await page.goto('/?state=practice-session');
  const answer = page.getByLabel('Deine Antwort');

  await answer.fill('memroy');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByText('Noch nicht sicher')).toBeVisible();
  const overrule = page.getByRole('button', { name: 'Als richtig werten' });
  await expect(overrule).toHaveAccessibleDescription(overruleConsequence);
  await overrule.click();

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
