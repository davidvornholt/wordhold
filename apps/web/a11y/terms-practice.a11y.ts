import { expect, test } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

const definition =
  'Ein Stoff, der die Aktivierungsenergie einer Reaktion senkt und dabei nicht verbraucht wird.\nBeispiel: Platin im Abgaskatalysator.';
const slippedCopy = definition.replace('senkt', 'erhöht');
// innerText keeps a line break only where the page shows one.
const secondLine = 'Beispiel: Platin im Abgaskatalysator.';

test('a definition names the missed key point and keeps a slipped copy', async ({
  page,
}) => {
  await page.goto('/?state=terms-practice');
  await expect(page.getByText('Erkläre den Begriff')).toBeVisible();
  const answer = page.getByLabel('Deine Antwort');
  await expect(answer).toBeFocused();
  // Enter in an empty field does nothing, as in the one-line field.
  await answer.press('Enter');
  await expect(page.getByText('Noch nicht sicher')).toHaveCount(0);
  await expect(answer).toBeFocused();
  await answer.fill('Ein Stoff, der die Aktivierungsenergie senkt.');
  // The definition field wraps, but Enter still submits.
  await answer.press('Enter');

  await expect(
    page.getByRole('listitem').filter({ hasText: 'Fehlt:' }),
  ).toContainText(
    'Fehlt: Er wird bei der Reaktion nicht verbraucht.Dass der Katalysator nicht verbraucht wird, fehlt.',
  );
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Genannt:' }),
  ).toHaveCount(2);
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Noch nicht sicher' })
      .getByText(secondLine),
  ).toHaveJSProperty('innerText', definition);

  const retype = page.getByLabel('Schreib die Antwort ab');
  await expect(retype).toBeFocused();
  await retype.fill(slippedCopy);
  await retype.press('Enter');
  await expect(
    page.getByText('Noch nicht ganz: Das 8. Wort ist „senkt“, nicht „erhöht“.'),
  ).toBeVisible();
  await expect(retype).toHaveValue(slippedCopy);

  await retype.fill(definition);
  await retype.press('Enter');
  await expect(page.locator('body')).toHaveAttribute(
    'data-fixture',
    'practice-empty',
  );
});

test('the learning pass shows a definition to copy and keeps a slipped copy', async ({
  page,
}) => {
  await page.goto('/?state=terms-learn');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Katalysator' }),
  ).toBeVisible();
  await expect(page.getByText('0 von 1 Begriff kennengelernt')).toBeVisible();
  await expect(page.getByText(secondLine)).toHaveJSProperty(
    'innerText',
    definition,
  );
  const field = page.getByLabel('Schreib die Definition ab');
  await expect(field).toBeFocused();
  await expect(field).toHaveAccessibleDescription(`Katalysator ${definition}`);
  await field.press('Enter');
  await expect(page.getByText('Noch nicht ganz')).toHaveCount(0);

  await field.fill(slippedCopy);
  await field.press('Enter');
  await expect(
    page.getByText('Noch nicht ganz: Das 8. Wort ist „senkt“, nicht „erhöht“.'),
  ).toBeVisible();
  await expect(field).toHaveValue(slippedCopy);

  await field.fill(definition);
  await field.press('Enter');
  await expect(
    page.getByRole('heading', {
      name: '1 Begriff kennengelernt',
    }),
  ).toBeVisible();
});
