export const fixtureStates = [
  'signed-out',
  'dashboard',
  'dashboard-empty',
  'dashboard-audio-recovery',
  'import',
  'import-error',
  'verification',
  'verification-empty',
  'verification-no-units',
  'verification-stale-unit',
  'verification-audio-recovery',
  'verification-deferred',
  'learn-units',
  'learn',
  'learn-retry',
  'learn-done',
  'course-settings',
  'course-settings-deferred',
  'practice',
  'practice-start',
  'practice-session',
  'practice-feedback',
  'practice-empty',
  'practice-complete-one-card',
  'practice-ungraded-one-card',
  'practice-deferred',
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

const audioRecoveryStorageKey = 'wordhold-a11y-audio-recovered';

export const audioRecoveryIsComplete = (): boolean =>
  globalThis.sessionStorage.getItem(audioRecoveryStorageKey) === 'true';

export const completeAudioRecovery = (): void => {
  globalThis.sessionStorage.setItem(audioRecoveryStorageKey, 'true');
};
