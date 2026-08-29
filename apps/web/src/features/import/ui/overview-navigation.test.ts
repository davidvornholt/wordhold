import { expect, it } from 'bun:test';
import { returnToFreshOverview } from './overview-navigation';

it('retires the cached overview before navigating after an import', async () => {
  const actions: Array<string> = [];

  await returnToFreshOverview({
    clearOverviewCache: () => actions.push('clear'),
    navigate: () => {
      actions.push('navigate');
      return Promise.resolve();
    },
  });

  expect(actions).toEqual(['clear', 'navigate']);
});
