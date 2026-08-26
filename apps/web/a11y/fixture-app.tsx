import {
  RootError,
  RootNotFound,
  RootPending,
} from '../src/shared/routing/root-feedback';
import { DashboardFixture, SignedOutFixture } from './dashboard-fixtures';
import { navigateToFixture, readFixtureState } from './fixture-state';
import {
  DeferredVerificationFixture,
  ImportFixture,
  VerificationFixture,
} from './import-fixtures';
import {
  LearnDoneFixture,
  LearnFixture,
  LearnUnitsFixture,
} from './learning-fixtures';
import {
  DeferredPracticeFixture,
  PracticeEmptyFixture,
  PracticeFeedbackFixture,
  PracticeFixture,
} from './practice-fixtures';

export const FixtureApp = () => {
  const state = readFixtureState();
  switch (state) {
    case 'signed-out':
      return <SignedOutFixture />;
    case 'dashboard':
      return <DashboardFixture />;
    case 'dashboard-empty':
      return <DashboardFixture empty={true} />;
    case 'dashboard-audio-recovery':
      return <DashboardFixture audioRecovery={true} />;
    case 'import':
      return <ImportFixture />;
    case 'import-error':
      return <ImportFixture error={true} />;
    case 'verification':
      return <VerificationFixture />;
    case 'verification-empty':
      return <VerificationFixture empty={true} />;
    case 'verification-audio-recovery':
      return <VerificationFixture audioRecovery={true} />;
    case 'verification-deferred':
      return <DeferredVerificationFixture />;
    case 'learn-units':
      return <LearnUnitsFixture />;
    case 'learn':
      return <LearnFixture />;
    case 'learn-done':
      return <LearnDoneFixture />;
    case 'practice':
      return <PracticeFixture />;
    case 'practice-feedback':
      return <PracticeFeedbackFixture />;
    case 'practice-empty':
      return <PracticeEmptyFixture />;
    case 'practice-deferred':
      return <DeferredPracticeFixture />;
    case 'loading':
      return <RootPending />;
    case 'error':
      return (
        <RootError
          error={new Error('Database unavailable')}
          reset={() => navigateToFixture('dashboard')}
        />
      );
    case 'not-found':
      return <RootNotFound />;
    default:
      return state satisfies never;
  }
};
