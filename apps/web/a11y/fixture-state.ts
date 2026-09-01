export const fixtureStates = [
  'signed-out',
  'dashboard',
  'dashboard-empty',
  'dashboard-learning',
  'dashboard-audio-recovery',
  'dashboard-pending',
  'import',
  'import-selected',
  'import-progress',
  'import-complete',
  'import-failed',
  'import-error',
  'import-session',
  'verification',
  'verification-duplicates',
  'verification-all-duplicates',
  'verification-batch-first',
  'verification-batch-second',
  'verification-batch-complete',
  'verification-empty',
  'verification-no-units',
  'verification-stale-unit',
  'verification-deferred',
  'verification-audio-recovery-deferred',
  'course',
  'course-no-practice',
  'course-empty-units',
  'unit',
  'unit-unintroduced',
  'unit-due',
  'unit-empty',
  'learn',
  'learn-audio',
  'learn-start',
  'learn-native',
  'learn-retry',
  'learn-done',
  'learn-section-done',
  'course-settings',
  'vocabulary',
  'vocabulary-difficult',
  'study-start',
  'course-settings-deferred',
  'practice',
  'practice-start',
  'practice-start-partial',
  'practice-session',
  'study-session',
  'practice-feedback',
  'practice-empty',
  'practice-complete-one-card',
  'practice-ungraded-one-card',
  'practice-deferred',
  'loading',
  'error',
  'not-found',
] as const;

const transitionFixtureStates = ['verification-audio-recovery'] as const;
const allFixtureStates = [...fixtureStates, ...transitionFixtureStates];

export type FixtureState = (typeof allFixtureStates)[number];

export const readFixtureState = (): FixtureState => {
  const requested = new URLSearchParams(globalThis.location.search).get(
    'state',
  );
  if (allFixtureStates.some((state) => state === requested)) {
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
