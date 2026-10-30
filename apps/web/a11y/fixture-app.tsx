import { OwnerTimeZoneContext } from '../src/shared/dates/owner-time-zone';
import { AppShell } from '../src/shared/ui/app-shell';
import { wordmarkClass } from '../src/shared/ui/shell-styles';
import {
  JoinFixture,
  PasskeysFixture,
  SignedOutFixture,
} from './account-fixtures';
import { BatchReviewFixture } from './batch-review-fixtures';
import { BookFixture } from './book-fixtures';
import { ImportFixture } from './capture-fixtures';
import { CourseFixture, UnitFixture } from './course-fixtures';
import { DashboardFixture } from './dashboard-fixtures';
import {
  CourseSettingsFixture,
  DeferredCourseSettingsFixture,
} from './direction-fixtures';
import { type FixtureState, readFixtureState } from './fixture-state';
import { ImportSessionFixture } from './import-session-fixture';
import {
  LearnDeferredFixture,
  LearnDoneFixture,
  LearnFixture,
  LearnSectionDoneFixture,
  LearnStartFixture,
} from './learning-fixtures';
import { PeopleFixture, PeopleProgressFixture } from './people-fixtures';
import { isPracticeState, practiceFixture } from './practice-fixture-router';
import { rootFixture } from './root-fixtures';
import { StudyStartFixture } from './study-fixtures';
import {
  SubjectCourseFixture,
  SubjectSettingsFixture,
} from './subject-fixtures';
import { TermReviewFixture } from './term-review-fixtures';
import {
  TermsFeedbackFixture,
  TermsLearnFixture,
  TermsPracticeFixture,
} from './terms-fixtures';
import {
  TextsCourseFixture,
  TextsFeedbackFixture,
  TextsLearnFixture,
  TextsPracticeFixture,
  TextsSettingsFixture,
} from './text-fixtures';
import { verificationFixture } from './verification-fixture-router';
import { VocabularyFixture } from './vocabulary-fixtures';
import { WordRelationFixture } from './word-relation-fixtures';

// States that production renders without the home shell: focus routes and
// the root feedback screens, which replace the root layout entirely.
const bareStates: ReadonlySet<FixtureState> = new Set<FixtureState>([
  'learn',
  'learn-audio',
  'learn-deferred',
  'learn-start',
  'learn-native',
  'learn-retry',
  'learn-done',
  'learn-section-done',
  'study-start',
  'study-start-unlearned',
  'practice',
  'practice-start',
  'practice-start-partial',
  'practice-session',
  'study-session',
  'practice-feedback',
  'practice-feedback-alternative',
  'practice-empty',
  'practice-complete-one-card',
  'practice-ungraded-one-card',
  'practice-deferred',
  'french-practice',
  'sentence-practice',
  'practice-other-wording',
  'terms-learn',
  'terms-practice',
  'terms-feedback',
  'texts-learn',
  'texts-practice',
  'texts-feedback',
  'loading',
  'error',
  'not-found',
]);

const importFixture = (state: FixtureState) => {
  switch (state) {
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
    default:
      return null;
  }
};

const batchReviewFixture = (state: FixtureState) => {
  switch (state) {
    case 'verification-batch-first':
      return <BatchReviewFixture position={1} />;
    case 'verification-batch-second':
      return <BatchReviewFixture position={2} />;
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
    case 'learn-deferred':
      return <LearnDeferredFixture />;
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

// The pages of subjects and collections, which every state not handled
// elsewhere belongs to.
type ListCourseState = Extract<
  FixtureState,
  `terms-${string}` | `texts-${string}`
>;

const listCourseFixture = (state: ListCourseState) => {
  switch (state) {
    case 'terms-learn':
      return <TermsLearnFixture />;
    case 'terms-practice':
      return <TermsPracticeFixture />;
    case 'terms-feedback':
      return <TermsFeedbackFixture />;
    case 'terms-course':
      return <SubjectCourseFixture />;
    case 'terms-course-empty':
      return <SubjectCourseFixture empty={true} />;
    case 'terms-settings':
      return <SubjectSettingsFixture />;
    case 'terms-review':
      return <TermReviewFixture empty={false} />;
    case 'terms-review-empty':
      return <TermReviewFixture empty={true} />;
    case 'texts-learn':
      return <TextsLearnFixture />;
    case 'texts-practice':
      return <TextsPracticeFixture />;
    case 'texts-feedback':
      return <TextsFeedbackFixture />;
    case 'texts-course':
      return <TextsCourseFixture />;
    case 'texts-course-empty':
      return <TextsCourseFixture empty={true} />;
    case 'texts-settings':
      return <TextsSettingsFixture />;
    default:
      return state satisfies never;
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
    case 'course-no-books':
      return <CourseFixture withoutBooks={true} />;
    default:
      return null;
  }
};

const accountFixture = (state: FixtureState) => {
  switch (state) {
    case 'signed-out':
      return <SignedOutFixture />;
    case 'join':
      return <JoinFixture />;
    case 'passkeys':
      return <PasskeysFixture />;
    case 'people':
      return <PeopleFixture />;
    case 'people-progress':
      return <PeopleProgressFixture />;
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
    subjects={state === 'dashboard-subjects'}
    twoCourses={state === 'dashboard-two-courses'}
  />
);

const fixtureContent = (state: FixtureState) => {
  if (isPracticeState(state)) {
    return practiceFixture(state);
  }
  switch (state) {
    case 'signed-out':
    case 'join':
    case 'passkeys':
    case 'people':
    case 'people-progress':
      return accountFixture(state);
    case 'dashboard':
    case 'dashboard-empty':
    case 'dashboard-learning':
    case 'dashboard-audio-recovery':
    case 'dashboard-pending':
    case 'dashboard-two-courses':
    case 'dashboard-subjects':
      return dashboardFixture(state);
    case 'import':
    case 'import-selected':
    case 'import-progress':
    case 'import-complete':
    case 'import-failed':
    case 'import-error':
    case 'import-session':
      return importFixture(state);
    case 'verification-batch-first':
    case 'verification-batch-second':
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
    case 'course-no-books':
      return courseFixture(state);
    case 'book':
      return <BookFixture kind="textbook" />;
    case 'book-novel':
      return <BookFixture kind="novel" />;
    case 'book-new':
      return <BookFixture kind="new" />;
    case 'unit':
      return <UnitFixture />;
    case 'unit-unintroduced':
      return <UnitFixture state="unintroduced" />;
    case 'unit-due':
      return <UnitFixture state="due" />;
    case 'unit-empty':
      return <UnitFixture state="empty" />;
    case 'word-relations':
      return <WordRelationFixture />;
    case 'learn':
    case 'learn-audio':
    case 'learn-deferred':
    case 'learn-start':
    case 'learn-native':
    case 'learn-retry':
    case 'learn-done':
    case 'learn-section-done':
      return learningFixture(state);
    case 'course-settings':
      return <CourseSettingsFixture />;
    case 'vocabulary':
    case 'vocabulary-difficult':
    case 'vocabulary-pitfalls':
    case 'vocabulary-related':
      return <VocabularyFixture state={state} />;
    case 'study-start':
      return <StudyStartFixture />;
    case 'study-start-unlearned':
      return <StudyStartFixture unlearned={true} />;
    case 'course-settings-deferred':
      return <DeferredCourseSettingsFixture />;
    case 'loading':
    case 'error':
    case 'not-found':
      return rootFixture(state);
    default:
      return listCourseFixture(state);
  }
};

// Production's root route provides the zone it loads from the server.
const fixtureTimeZone = 'Europe/Berlin';

export const FixtureApp = () => {
  const state = readFixtureState();
  const content = fixtureContent(state);
  return (
    <OwnerTimeZoneContext value={fixtureTimeZone}>
      {bareStates.has(state) ? (
        content
      ) : (
        <AppShell
          home={
            <a className={wordmarkClass} href="/?state=dashboard">
              Wordhold
            </a>
          }
        >
          {content}
        </AppShell>
      )}
    </OwnerTimeZoneContext>
  );
};
