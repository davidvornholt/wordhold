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
import { type FixtureState, readFixtureState } from './fixture-state';
import { ImportSessionFixture } from './import-session-fixture';
import {
  LearnDoneFixture,
  LearnFixture,
  LearnSectionDoneFixture,
  LearnStartFixture,
} from './learning-fixtures';
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
import { rootFixture } from './root-fixtures';
import { StudyStartFixture } from './study-fixtures';
import { verificationFixture } from './verification-fixture-router';
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

const learningFixture = (state: FixtureState) => {
  switch (state) {
    case 'learn':
      return <LearnFixture />;
    case 'learn-audio':
      return <LearnFixture withAudio={true} />;
    case 'learn-start':
      return <LearnStartFixture />;
    case 'learn-native':
      return <LearnFixture direction="to_native" />;
    case 'learn-retry':
      return <LearnFixture failFirst={true} />;
    case 'learn-done':
      return <LearnDoneFixture />;
    case 'learn-section-done':
      return <LearnSectionDoneFixture />;
    default:
      return null;
  }
};

const courseFixture = (state: FixtureState) => {
  switch (state) {
    case 'course':
      return <CourseFixture />;
    case 'course-no-practice':
      return <CourseFixture practiceAvailable={false} />;
    case 'course-empty-units':
      return <CourseFixture emptyVocabulary={true} />;
    default:
      return null;
  }
};

const dashboardFixture = (state: FixtureState) => (
  <DashboardFixture
    audioRecovery={state === 'dashboard-audio-recovery'}
    empty={state === 'dashboard-empty'}
    pending={state === 'dashboard-pending'}
    resting={state === 'dashboard-learning'}
  />
);

export const FixtureApp = () => {
  const state = readFixtureState();
  switch (state) {
    case 'signed-out':
      return <SignedOutFixture />;
    case 'dashboard':
    case 'dashboard-empty':
    case 'dashboard-learning':
    case 'dashboard-audio-recovery':
    case 'dashboard-pending':
      return dashboardFixture(state);
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
    case 'verification-batch-first':
    case 'verification-batch-second':
    case 'verification-batch-complete':
      return batchReviewFixture(state);
    case 'verification':
    case 'verification-duplicates':
    case 'verification-all-duplicates':
    case 'verification-empty':
    case 'verification-no-units':
    case 'verification-stale-unit':
    case 'verification-audio-recovery-deferred':
    case 'verification-audio-recovery':
    case 'verification-deferred':
      return verificationFixture(state);
    case 'course':
    case 'course-no-practice':
    case 'course-empty-units':
      return courseFixture(state);
    case 'unit':
      return <UnitFixture />;
    case 'unit-unintroduced':
      return <UnitFixture state="unintroduced" />;
    case 'unit-due':
      return <UnitFixture state="due" />;
    case 'unit-empty':
      return <UnitFixture state="empty" />;
    case 'learn':
    case 'learn-audio':
    case 'learn-start':
    case 'learn-native':
    case 'learn-retry':
    case 'learn-done':
    case 'learn-section-done':
      return learningFixture(state);
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
    case 'practice-start-partial':
      return <PracticeStartFixture partial={true} />;
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
    case 'error':
    case 'not-found':
      return rootFixture(state);
    default:
      return state satisfies never;
  }
};
