import { expect, it } from 'bun:test';
import {
  retireOverviewCache,
  returnToFreshOverview,
} from './overview-navigation';

it('retires the cached overview while an imported page waits for audio', () => {
  let cleared = false;

  retireOverviewCache({
    clearOverviewCache: () => {
      cleared = true;
    },
  });

  expect(cleared).toBe(true);
});

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
