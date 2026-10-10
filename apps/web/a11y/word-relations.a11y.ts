import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { assertNoAccessibilityViolations } from './a11y-assertions';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('suggested synonyms and antonyms fill open lists and are saved after review', async ({
  page,
}) => {
  await page.goto('/?state=word-relations');
  await expect(
    page.getByText('Bei 2 Wörtern fehlen Synonyme oder Gegenteile.'),
  ).toBeVisible();
  const save = page.getByRole('button', { name: 'Speichern' });
  await expect(save).toBeDisabled();

  await page.getByRole('button', { name: 'Fehlende vorschlagen' }).click();
  const hostileSynonyms = page.getByLabel('Synonyme zu hostile');
  await expect(hostileSynonyms).toHaveValue('unfriendly, aggressive');
  await expect(hostileSynonyms).toHaveAccessibleDescription(
    'Vorschlag – bitte prüfen.',
  );
  await expect(hostileSynonyms).toHaveAttribute('lang', 'en');
  // The synonym printed on the page stays; only the open list is filled.
  await expect(page.getByLabel('Synonyme zu brave')).toHaveValue('courageous');
  await expect(page.getByLabel('Gegenteile zu brave')).toHaveValue('cowardly');
  await expect(page.getByLabel('Synonyme zu holiday')).toHaveValue('');
  await expect(page.getByText('2 Wörter geändert')).toBeVisible();
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));

  const hostileAntonyms = page.getByLabel('Gegenteile zu hostile');
  await hostileAntonyms.fill('a, b, c, d, e, f, g, h, i');
  await expect(hostileAntonyms).toHaveAttribute('aria-invalid', 'true');
  await expect(hostileAntonyms).toHaveAccessibleDescription(
    'Höchstens 8 Wörter.',
  );
  await expect(save).toBeDisabled();
  await hostileAntonyms.fill('friendly, kind');
  await expect(save).toBeEnabled();

  await save.click();
  await expect(page.getByText('Gespeichert.')).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(hostileAntonyms).toHaveValue('friendly, kind');
  await expect(hostileSynonyms).not.toHaveAccessibleDescription(
    'Vorschlag – bitte prüfen.',
  );
  await expect(
    page.getByRole('button', { name: 'Fehlende vorschlagen' }),
  ).toHaveCount(0);
  assertNoAccessibilityViolations(await scanWcag22AaViolations(page));
});
