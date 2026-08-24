export const fixtureStates = [
  'signed-out',
  'dashboard',
  'dashboard-empty',
  'import',
  'import-error',
  'verification',
  'verification-empty',
  'verification-audio-recovery',
  'practice',
  'practice-feedback',
  'practice-empty',
  'loading',
  'error',
  'not-found',
] as const;

export type FixtureState = (typeof fixtureStates)[number];

export const readFixtureState = (): FixtureState => {
  const requested = new URLSearchParams(globalThis.location.search).get(
    'state',
  );
  if (fixtureStates.some((state) => state === requested)) {
    return requested as FixtureState;
  }
  throw new Error(`Unknown accessibility fixture state: ${String(requested)}`);
};

export const navigateToFixture = (state: FixtureState): void => {
  globalThis.location.assign(`/?state=${state}`);
};
