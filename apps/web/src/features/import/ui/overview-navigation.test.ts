import { expect, it } from 'bun:test';
import {
  refreshOverviewAfterMutation,
  retireOverviewCache,
  returnToFreshOverview,
} from './overview-navigation';

it('invalidates the active and cached overview after an import mutation', async () => {
  let options:
    | {
        readonly filter: (match: { readonly routeId: string }) => boolean;
        readonly sync: true;
      }
    | undefined;

  await refreshOverviewAfterMutation((next) => {
    options = next;
    return Promise.resolve();
  });

  expect(options?.sync).toBe(true);
  expect(options?.filter({ routeId: '/' })).toBe(true);
  expect(options?.filter({ routeId: '/pages/$pageId/verify' })).toBe(false);
});

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
