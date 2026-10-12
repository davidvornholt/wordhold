import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const skipAction = /^Kennenlernen überspringen/u;
const reopenAction = /^Wieder kennenlernen/u;

test('an entry skips and reopens its learning pass one direction at a time', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary');
  await page.getByRole('button', { exact: true, name: 'memory' }).click();
  const memory = page.getByRole('dialog', { name: 'memory' });
  const status = memory.getByRole('status', { name: 'Status beim Bearbeiten' });
  // The practised direction keeps its schedule; only the other one is open.
  await expect(memory.getByRole('button', { name: skipAction })).toHaveCount(1);
  await expect(memory.getByRole('button', { name: reopenAction })).toHaveCount(
    0,
  );
  const skipButton = memory.getByRole('button', {
    name: 'Kennenlernen überspringen · Englisch → Deutsch',
  });
  await skipButton.click();

  const reopen = memory.getByRole('button', {
    name: 'Wieder kennenlernen · Englisch → Deutsch',
  });
  await expect(reopen).toBeFocused();
  await expect(status).toHaveText(
    'Kennenlernen übersprungen · Englisch → Deutsch',
  );
  await expect(memory.getByText('Bereit für die erste Übung')).toBeVisible();
  await expect(memory.getByText('2× nicht gewusst')).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  await reopen.click();
  await expect(skipButton).toBeFocused();
  await expect(status).toHaveText(
    'Kennenlernen wieder offen · Englisch → Deutsch',
  );
  await expect(memory.getByText('Noch nicht kennengelernt')).toBeVisible();
});

test('reopening one direction leaves the other ready for practice', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary');
  await page.getByRole('button', { exact: true, name: 'the referee' }).click();
  const referee = page.getByRole('dialog', { name: 'the referee' });
  await referee
    .getByRole('button', { name: 'Wieder kennenlernen · Deutsch → Englisch' })
    .click();
  await expect(
    referee.getByRole('button', {
      name: 'Kennenlernen überspringen · Deutsch → Englisch',
    }),
  ).toBeFocused();
  await expect(
    referee.getByRole('button', {
      name: 'Wieder kennenlernen · Englisch → Deutsch',
    }),
  ).toBeVisible();
  await expect(referee.getByText('Bereit für die erste Übung')).toHaveCount(1);
  await expect(referee.getByText('Noch nicht kennengelernt')).toHaveCount(1);
});

test('a selection skips its learning pass per direction and can undo it', async ({
  page,
}) => {
  await page.goto('/?state=vocabulary');
  await page.getByLabel('memory auswählen').check();
  await page.getByLabel('the referee auswählen').check();
  const openDialog = page.getByRole('button', {
    exact: true,
    name: 'Kennenlernen überspringen',
  });
  await expect(openDialog).toHaveAttribute('aria-haspopup', 'dialog');
  await openDialog.click();
  const dialog = page.getByRole('dialog', {
    name: 'Kennenlernen überspringen',
  });
  const toTarget = dialog.getByRole('region', { name: 'Deutsch → Englisch' });
  const toNative = dialog.getByRole('region', { name: 'Englisch → Deutsch' });
  const status = dialog.getByRole('status', {
    name: 'Status beim Überspringen',
  });
  await expect(toTarget).toContainText('Alle schon kennengelernt');
  await expect(toTarget.getByRole('button')).toHaveCount(0);
  await expect(toNative).toContainText(
    '1 von 2 Vokabeln noch nicht kennengelernt',
  );
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  const skipButton = toNative.getByRole('button', {
    name: '1 Vokabel überspringen · Englisch → Deutsch',
  });
  const undo = toNative.getByRole('button', {
    name: 'Rückgängig · Englisch → Deutsch',
  });
  await skipButton.click();
  await expect(undo).toBeFocused();
  await expect(toNative).toContainText(
    '1 Vokabel übersprungen · bereit für die erste Übung',
  );
  await expect(status).toHaveText(
    '1 Vokabel übersprungen · Englisch → Deutsch',
  );
  await undo.click();
  await expect(skipButton).toBeFocused();
  await expect(status).toHaveText(
    'Überspringen rückgängig gemacht · Englisch → Deutsch',
  );

  // Once nothing is left to skip, the button that opened the dialog is gone
  // and focus returns to the selection instead.
  await skipButton.click();
  await expect(undo).toBeFocused();
  await dialog.getByRole('button', { name: 'Fertig' }).click();
  await expect(dialog).toBeHidden();
  await expect(openDialog).toBeHidden();
  await expect(page.getByText('2 Vokabeln ausgewählt')).toBeFocused();

  await page.getByRole('button', { exact: true, name: 'memory' }).click();
  await expect(
    page.getByRole('dialog', { name: 'memory' }).getByRole('button', {
      name: 'Wieder kennenlernen · Englisch → Deutsch',
    }),
  ).toBeVisible();
});

test('a term has one learning pass to skip, without naming a direction', async ({
  page,
}) => {
  await page.goto('/?state=terms-course');
  await page.getByLabel('Enzym auswählen').check();
  await page.getByLabel('Katalysator auswählen').check();
  await page
    .getByRole('button', { exact: true, name: 'Kennenlernen überspringen' })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Kennenlernen überspringen',
  });
  await expect(dialog).toContainText(
    '1 von 2 Begriffen noch nicht kennengelernt',
  );
  await expect(dialog).toContainText('in den Details des Begriffs');
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await dialog
    .getByRole('button', { exact: true, name: '1 Begriff überspringen' })
    .click();
  await expect(
    dialog.getByRole('button', { exact: true, name: 'Rückgängig' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { exact: true, name: 'Enzym' }).click();
  const enzym = page.getByRole('dialog', { name: 'Enzym' });
  await enzym
    .getByRole('button', { exact: true, name: 'Wieder kennenlernen' })
    .click();
  await expect(
    enzym.getByRole('status', { name: 'Status beim Bearbeiten' }),
  ).toHaveText('Kennenlernen wieder offen');
  await expect(
    enzym.getByRole('button', {
      exact: true,
      name: 'Kennenlernen überspringen',
    }),
  ).toBeFocused();
});
