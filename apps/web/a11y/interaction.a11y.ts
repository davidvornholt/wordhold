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

// Nothing in the learning pass is graded, but it does decide which words the
// scheduler is allowed to ask about, so a word must not count as met until it
// has actually been written correctly.
test('the learning pass asks again for a wrong copy and records only the correct ones', async ({
  page,
}) => {
  await page.goto('/?state=learn');
  const field = page.getByLabel('Schreib das Wort ab');
  const advance = page.getByRole('button', { name: 'Weiter' });
  await expect(page.getByText('Wort 1 von 2')).toBeVisible();

  await field.fill('remember');
  await advance.click();
  await expect(
    page.getByText('Noch nicht ganz. Schreib das Wort genau so ab.'),
  ).toBeVisible();
  await expect(page.getByText('Wort 1 von 2')).toBeVisible();
  await expect(page.getByLabel('Introduced words')).toHaveText('0');

  await field.fill('Memory');
  await advance.click();
  await expect(page.getByText('Wort 2 von 2')).toBeVisible();
  await expect(page.getByLabel('Introduced words')).toHaveText('1');

  await page.getByLabel('Schreib das Wort ab').fill('to look at');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('Einheit gelernt!')).toBeVisible();
  await expect(page.getByLabel('Introduced words')).toHaveText('2');
});

// A missed card has to come back inside the session. If it leaves instead, it
// sits on FSRS's one-minute relearning step and the dashboard says "Üben" again
// a minute after the session was finished.
test('a missed card returns later in the session without moving the progress bar', async ({
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
  await next.click();
  await expect(progress).toHaveText('0 von 2 Karten geschafft');
  await expect(page.getByText('Ferien')).toBeVisible();

  await answer.fill('holiday');
  await check.click();
  await next.click();
  await expect(progress).toHaveText('1 von 2 Karten geschafft');
  await expect(page.getByText('Erinnerung')).toBeVisible();
  await expect(page.getByText('Noch einmal')).toBeVisible();
  // The first attempt bumped the card's revision; answering the repeat against
  // the old one would be rejected as a stale submission.
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
