import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

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
  await expect(page.getByText('Leider falsch.')).toBeVisible();
});

test('CardPractice unlocks a rejected answer for a new submission', async ({
  page,
}) => {
  await page.goto('/?state=practice-deferred');
  const answer = page.getByLabel('Deine Antwort');
  await answer.fill('first answer');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await page.getByRole('button', { name: 'Reject submission' }).click();

  await expect(page.getByText('Test rejection')).toBeVisible();
  await expect(answer).toBeEnabled();
  await answer.fill('recovered answer');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByLabel('Submit calls')).toHaveText('2');
  await expect(page.getByLabel('Submitted answer')).toHaveText(
    'recovered answer',
  );

  await page.getByRole('button', { name: 'Resolve submission' }).click();
  await expect(page.getByText('Leider falsch.')).toBeVisible();
});

test('VerifyForm freezes every control and ignores resubmission', async ({
  page,
}) => {
  await page.goto('/?state=verification-deferred');
  const label = page.getByLabel('Seitenbezeichnung');
  const target = page.getByLabel('Englisch');
  const add = page.getByRole('button', { name: 'Eintrag hinzufügen' });
  const remove = page.getByRole('button', { name: 'Entfernen' });
  await label.fill('First label');
  await target.fill('first target');
  await page.getByRole('button', { name: '1 Einträge importieren' }).click();

  await Promise.all(
    [label, target, add, remove].map((control) =>
      expect(control).toBeDisabled(),
    ),
  );
  expect(
    await actionIsRejected(label.fill('Changed label', { timeout: 250 })),
  ).toBe(true);
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
    '"label":"First label"',
  );
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
  const label = page.getByLabel('Seitenbezeichnung');
  const target = page.getByLabel('Englisch');
  await label.fill('First label');
  await target.fill('first target');
  await page.getByRole('button', { name: '1 Einträge importieren' }).click();
  await page.getByRole('button', { name: 'Reject verification' }).click();

  await expect(page.getByLabel('Verification status')).toHaveText('rejected');
  await expect(label).toBeEnabled();
  await label.fill('Recovered label');
  await target.fill('recovered target');
  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
  await expect(page.getByRole('button', { name: 'Entfernen' })).toHaveCount(2);
  await page.getByRole('button', { name: 'Entfernen' }).last().click();
  await page.getByRole('button', { name: '1 Einträge importieren' }).click();

  await expect(page.getByLabel('Verification calls')).toHaveText('2');
  await expect(page.getByLabel('Verification snapshot')).toContainText(
    '"label":"Recovered label"',
  );
  await expect(page.getByLabel('Verification snapshot')).toContainText(
    '"targetText":"recovered target"',
  );
  await page.getByRole('button', { name: 'Resolve verification' }).click();
  await expect(page.getByLabel('Verification status')).toHaveText('resolved');
});
