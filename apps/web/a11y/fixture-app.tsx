import {
  RootError,
  RootNotFound,
  RootPending,
} from '../src/shared/routing/root-feedback';
import {
  BatchReviewCompleteFixture,
  BatchReviewFixture,
} from './batch-review-fixtures';
import { ImportFixture } from './capture-fixtures';
import { CourseFixture, UnitFixture } from './course-fixtures';
import { DashboardFixture, SignedOutFixture } from './dashboard-fixtures';
import {
  CourseSettingsFixture,
  DeferredCourseSettingsFixture,
  PracticeStartFixture,
} from './direction-fixtures';
import {
  type FixtureState,
  navigateToFixture,
  readFixtureState,
} from './fixture-state';
import {
  DeferredVerificationFixture,
  VerificationFixture,
} from './import-fixtures';
import { ImportSessionFixture } from './import-session-fixture';
import { LearnDoneFixture, LearnFixture } from './learning-fixtures';
import {
  DeferredPracticeFixture,
  PracticeEmptyFixture,
  PracticeFeedbackFixture,
  PracticeFixture,
  PracticeOneCardSummaryFixture,
} from './practice-fixtures';
import {
  FutureStudySessionFixture,
  PracticeSessionFixture,
} from './practice-session-fixtures';
import { StaleUnitVerificationFixture } from './stale-unit-fixture';
import { StudyStartFixture } from './study-fixtures';
import { VocabularyFixture } from './vocabulary-fixtures';

const batchReviewFixture = (state: FixtureState) => {
  switch (state) {
    case 'verification-batch-first':
      return <BatchReviewFixture position={1} />;
    case 'verification-batch-second':
      return <BatchReviewFixture position={2} />;
    case 'verification-batch-complete':
      return <BatchReviewCompleteFixture />;
    default:
      return null;
  }
};

const ErrorFixture = () => (
  <RootError
    error={new Error('Database unavailable')}
    reset={() => navigateToFixture('dashboard')}
  />
);

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
    case 'dashboard-pending':
      return <DashboardFixture pending={true} />;
    case 'import':
      return <ImportFixture />;
    case 'import-selected':
      return <ImportFixture initialState="selected" />;
    case 'import-progress':
      return <ImportFixture initialState="progress" />;
    case 'import-complete':
      return <ImportFixture initialState="complete" />;
    case 'import-failed':
      return <ImportFixture initialState="failed" />;
    case 'import-error':
      return <ImportFixture error={true} />;
    case 'import-session':
      return <ImportSessionFixture />;
    case 'verification':
      return <VerificationFixture />;
    case 'verification-duplicates':
      return <VerificationFixture duplicates={true} />;
    case 'verification-all-duplicates':
      return <VerificationFixture allDuplicates={true} />;
    case 'verification-batch-first':
    case 'verification-batch-second':
    case 'verification-batch-complete':
      return batchReviewFixture(state);
    case 'verification-empty':
      return <VerificationFixture empty={true} />;
    case 'verification-no-units':
      return <VerificationFixture noUnits={true} />;
    case 'verification-stale-unit':
      return <StaleUnitVerificationFixture />;
    case 'verification-audio-recovery':
      return <VerificationFixture audioRecovery={true} />;
    case 'verification-deferred':
      return <DeferredVerificationFixture />;
    case 'course':
      return <CourseFixture />;
    case 'course-no-practice':
      return <CourseFixture practiceAvailable={false} />;
    case 'unit':
      return <UnitFixture />;
    case 'unit-unintroduced':
      return <UnitFixture state="unintroduced" />;
    case 'unit-empty':
      return <UnitFixture state="empty" />;
    case 'learn':
      return <LearnFixture />;
    case 'learn-retry':
      return <LearnFixture failFirst={true} />;
    case 'learn-done':
      return <LearnDoneFixture />;
    case 'course-settings':
      return <CourseSettingsFixture />;
    case 'vocabulary':
      return <VocabularyFixture />;
    case 'vocabulary-difficult':
      return <VocabularyFixture difficult={true} />;
    case 'study-start':
      return <StudyStartFixture />;
    case 'course-settings-deferred':
      return <DeferredCourseSettingsFixture />;
    case 'practice':
      return <PracticeFixture />;
    case 'practice-start':
      return <PracticeStartFixture />;
    case 'practice-session':
      return <PracticeSessionFixture />;
    case 'study-session':
      return <FutureStudySessionFixture />;
    case 'practice-feedback':
      return <PracticeFeedbackFixture />;
    case 'practice-empty':
      return <PracticeEmptyFixture />;
    case 'practice-complete-one-card':
      return <PracticeOneCardSummaryFixture ungraded={false} />;
    case 'practice-ungraded-one-card':
      return <PracticeOneCardSummaryFixture ungraded={true} />;
    case 'practice-deferred':
      return <DeferredPracticeFixture />;
    case 'loading':
      return <RootPending />;
    case 'error':
      return <ErrorFixture />;
    case 'not-found':
      return <RootNotFound />;
    default:
      return state satisfies never;
  }
};
