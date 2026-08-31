import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

const threePageStackAction = /3 Seiten.*fortsetzen/u;

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const deleteName = 'English A2, 3 Seiten, 24.8.2026 löschen';

test('pages from one upload appear as one resumable stack', async ({
  page,
}) => {
  await page.goto('/?state=dashboard-pending');
  const openImports = page.getByTestId('open-imports');
  await expect(openImports.getByRole('listitem')).toHaveCount(1);
  await expect(openImports.getByText('3 Seiten · 24.8.2026')).toBeVisible();
  await expect(
    openImports.getByRole('button', { name: threePageStackAction }),
  ).toBeVisible();
});

test('an open import can be confirmed and removed from the dashboard', async ({
  page,
}) => {
  await page.goto('/?state=dashboard-pending');
  const deleteAction = page.getByRole('button', { name: deleteName });
  await deleteAction.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('3 Seiten und die Fotos werden endgültig gelöscht.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Endgültig löschen' }),
  ).toBeFocused();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(deleteAction).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Endgültig löschen' }).press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Offene Importe' }),
  ).toHaveCount(0);
});

const actionIsRejected = async (action: Promise<unknown>): Promise<boolean> =>
  action.then(
    () => false,
    () => true,
  );

test('CardPractice freezes the submitted answer and ignores resubmission', async ({
  page,
}) => {
  await page.goto('/?state=practice-deferred');
  const answer = page.getByLabel('Deine Antwort');
  await answer.fill('first answer');
  await page.getByRole('button', { name: 'Prüfen' }).click();

  await expect(answer).toBeDisabled();
  await expect(answer).toHaveValue('first answer');
  await expect(page.getByLabel('Submit calls')).toHaveText('1');
  await expect(page.getByLabel('Submitted answer')).toHaveText('first answer');
  expect(
    await actionIsRejected(answer.fill('changed answer', { timeout: 250 })),
  ).toBe(true);
  await page.locator('form').evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByLabel('Submit calls')).toHaveText('1');
  await expect(answer).toHaveValue('first answer');

  await page.getByRole('button', { name: 'Resolve submission' }).click();
  await expect(page.getByText('Noch nicht sicher')).toBeVisible();
});

test('CardPractice unlocks a rejected answer for a new submission', async ({
  page,
}) => {
  await page.goto('/?state=practice-deferred');
  const answer = page.getByLabel('Deine Antwort');
  await answer.fill('first answer');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await page.getByRole('button', { name: 'Reject submission' }).click();

  await expect(
    page.getByText(
      'Deine Antwort konnte nicht geprüft werden. Prüfe deine Verbindung und versuche es noch einmal.',
    ),
  ).toBeVisible();
  await expect(answer).toBeEnabled();
  await answer.fill('recovered answer');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByLabel('Submit calls')).toHaveText('2');
  await expect(page.getByLabel('Submitted answer')).toHaveText(
    'recovered answer',
  );

  await page.getByRole('button', { name: 'Resolve submission' }).click();
  await expect(page.getByText('Noch nicht sicher')).toBeVisible();
});

test('VerifyForm freezes every control and ignores resubmission', async ({
  page,
}) => {
  await page.goto('/?state=verification-deferred');
  const target = page.getByLabel('Englisch');
  const add = page.getByRole('button', { name: 'Eintrag hinzufügen' });
  const remove = page.getByRole('button', { name: 'Entfernen' });
  const unit = page.getByLabel('Einheit für Eintrag 1');
  const bulkUnit = page.getByLabel('Einheit für alle Vokabeln');
  const applyToAll = page.getByRole('button', {
    name: 'Auf alle anwenden',
  });
  await target.fill('first target');
  await page.getByRole('button', { name: '1 Eintrag importieren' }).click();

  await Promise.all(
    [target, unit, bulkUnit, applyToAll, add, remove].map((control) =>
      expect(control).toBeDisabled(),
    ),
  );
  expect(
    await actionIsRejected(target.fill('changed target', { timeout: 250 })),
  ).toBe(true);
  expect(await actionIsRejected(add.click({ timeout: 250 }))).toBe(true);
  expect(await actionIsRejected(remove.click({ timeout: 250 }))).toBe(true);
  await page.locator('form').evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByLabel('Verification calls')).toHaveText('1');
  await expect(page.getByLabel('Verification snapshot')).toContainText(
    '"targetText":"first target"',
  );

  await page.getByRole('button', { name: 'Resolve verification' }).click();
  await expect(page.getByLabel('Verification status')).toHaveText('resolved');
});

test('VerifyForm unlocks a rejected payload for a new submission', async ({
  page,
}) => {
  await page.goto('/?state=verification-deferred');
  const target = page.getByLabel('Englisch');
  await target.fill('first target');
  await page.getByRole('button', { name: '1 Eintrag importieren' }).click();
  await page.getByRole('button', { name: 'Reject verification' }).click();

  await expect(page.getByLabel('Verification status')).toHaveText('rejected');
  await target.fill('recovered target');
  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
  await expect(page.getByRole('button', { name: 'Entfernen' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Entfernen' }).last().click();
  await page.getByRole('button', { name: '1 Eintrag importieren' }).click();

  await expect(page.getByLabel('Verification calls')).toHaveText('2');
  await expect(page.getByLabel('Verification snapshot')).toContainText(
    '"targetText":"recovered target"',
  );
  await page.getByRole('button', { name: 'Resolve verification' }).click();
  await expect(page.getByLabel('Verification status')).toHaveText('resolved');
});
