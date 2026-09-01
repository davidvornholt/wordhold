import { DeferredAudioRecoveryFixture } from './deferred-audio-recovery-fixture';
import type { FixtureState } from './fixture-state';
import {
  DeferredVerificationFixture,
  VerificationFixture,
} from './import-fixtures';
import { StaleUnitVerificationFixture } from './stale-unit-fixture';

export const verificationFixture = (state: FixtureState) => {
  switch (state) {
    case 'verification':
      return <VerificationFixture />;
    case 'verification-duplicates':
      return <VerificationFixture duplicates={true} />;
    case 'verification-all-duplicates':
      return <VerificationFixture allDuplicates={true} />;
    case 'verification-empty':
      return <VerificationFixture empty={true} />;
    case 'verification-no-units':
      return <VerificationFixture noUnits={true} />;
    case 'verification-stale-unit':
      return <StaleUnitVerificationFixture />;
    case 'verification-audio-recovery':
      return <VerificationFixture audioRecovery={true} />;
    case 'verification-audio-recovery-deferred':
      return <DeferredAudioRecoveryFixture />;
    case 'verification-deferred':
      return <DeferredVerificationFixture />;
    default:
      return null;
  }
};
