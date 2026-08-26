import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

// A course with no direction left would schedule nothing and offer nothing,
// with no card on screen to switch a direction back on from.
test('the course settings save a direction change but refuse to switch off the last one', async ({
  page,
}) => {
  await page.goto('/?state=course-settings');
  const toTarget = page.getByLabel('Deutsch → Englisch');
  const toNative = page.getByLabel('Englisch → Deutsch');
  const status = page.getByRole('status');

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
