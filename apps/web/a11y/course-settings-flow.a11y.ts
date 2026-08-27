import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const pageColumnClass = /page-column/u;

// A course with no direction left would schedule nothing and offer nothing,
// with no card on screen to switch a direction back on from.
test('the course settings save a direction change but refuse to switch off the last one', async ({
  page,
}) => {
  await page.goto('/?state=course-settings');
  const toTarget = page.getByLabel('Deutsch → Englisch');
  const toNative = page.getByLabel('Englisch → Deutsch');
  const status = page.getByRole('status', { name: 'Speicherstatus' });
  await expect(page.locator('main')).toHaveClass(pageColumnClass);

  await toNative.uncheck();
  await expect(status).toHaveText('Gespeichert.');
  await expect(toNative).not.toBeChecked();

  // Deliberately a click and not `uncheck()`: the point is that the box does
  // not come off, which `uncheck()` would report as a failure of its own.
  await toTarget.click();
  await expect(status).toHaveText(
    'Eine Richtung bleibt immer an, sonst gibt es nichts zu üben.',
  );
  await expect(toTarget).toBeChecked();
});

const actionIsRejected = async (action: Promise<unknown>): Promise<boolean> =>
  action.then(
    () => false,
    () => true,
  );

test('a pending direction save blocks a second snapshot until it succeeds', async ({
  page,
}) => {
  await page.goto('/?state=course-settings-deferred');
  const toTarget = page.getByLabel('Deutsch → Englisch');
  const toNative = page.getByLabel('Englisch → Deutsch');
  const group = page.getByRole('group', { name: 'Abfragerichtungen' });

  await toNative.uncheck();
  await expect(group).toHaveAttribute('aria-busy', 'true');
  await expect(toTarget).toBeDisabled();
  await expect(toNative).toBeDisabled();
  const status = page.getByRole('status', { name: 'Speicherstatus' });
  await expect(status).toHaveText('Wird gespeichert …');
  expect(await actionIsRejected(toTarget.click({ timeout: 250 }))).toBe(true);
  await toTarget.evaluate((input: HTMLInputElement) => input.click());
  await expect(page.getByLabel('Direction save calls')).toHaveText('1');
  await expect(page.getByLabel('Direction save snapshot')).toHaveText(
    'to_target',
  );

  await page.getByRole('button', { name: 'Resolve direction save' }).click();
  await expect(status).toHaveText('Gespeichert.');
  await expect(group).toHaveAttribute('aria-busy', 'false');
  await expect(toTarget).toBeEnabled();
  await expect(toNative).toBeEnabled();
  await expect(toTarget).toBeChecked();
  await expect(toNative).not.toBeChecked();
  await expect(toNative).toBeFocused();
});

test('a rejected direction save restores the last durable snapshot', async ({
  page,
}) => {
  await page.goto('/?state=course-settings-deferred');
  const toTarget = page.getByLabel('Deutsch → Englisch');
  const toNative = page.getByLabel('Englisch → Deutsch');

  await toNative.uncheck();
  await page.getByRole('button', { name: 'Reject direction save' }).click();
  await expect(page.getByRole('status', { name: 'Speicherstatus' })).toHaveText(
    'Speichern fehlgeschlagen: Test direction rejection',
  );
  await expect(toTarget).toBeEnabled();
  await expect(toNative).toBeEnabled();
  await expect(toTarget).toBeChecked();
  await expect(toNative).toBeChecked();
  await expect(toNative).toBeFocused();
  await expect(page.getByLabel('Direction save calls')).toHaveText('1');
});
