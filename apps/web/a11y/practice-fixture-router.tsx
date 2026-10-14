import { PracticeStartFixture } from './direction-fixtures';
import type { FixtureState } from './fixture-state';
import { OtherWordingFixture } from './other-wording-fixtures';
import {
  DeferredPracticeFixture,
  PracticeEmptyFixture,
  PracticeFeedbackFixture,
  PracticeFixture,
  PracticeOneCardSummaryFixture,
} from './practice-fixtures';
import {
  FrenchPracticeFixture,
  FutureStudySessionFixture,
  PracticeSessionFixture,
} from './practice-session-fixtures';
import { SynonymPracticeFixture } from './relation-card-fixtures';
import { SentencePracticeFixture } from './sentence-fixtures';

// The practice states: answering cards, their feedback and the summary.
const practiceStates = [
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
  'synonym-practice',
  'practice-other-wording',
] as const satisfies ReadonlyArray<FixtureState>;

type PracticeState = (typeof practiceStates)[number];

export const isPracticeState = (state: FixtureState): state is PracticeState =>
  (practiceStates as ReadonlyArray<FixtureState>).includes(state);

export const practiceFixture = (state: PracticeState) => {
  switch (state) {
    case 'practice':
      return <PracticeFixture />;
    case 'practice-start':
      return <PracticeStartFixture />;
    case 'practice-start-partial':
      return <PracticeStartFixture partial={true} />;
    case 'practice-session':
      return <PracticeSessionFixture />;
    case 'french-practice':
      return <FrenchPracticeFixture />;
    case 'study-session':
      return <FutureStudySessionFixture />;
    case 'practice-feedback':
      return <PracticeFeedbackFixture alternative={false} />;
    case 'practice-feedback-alternative':
      return <PracticeFeedbackFixture alternative={true} />;
    case 'practice-empty':
      return <PracticeEmptyFixture />;
    case 'practice-complete-one-card':
      return <PracticeOneCardSummaryFixture ungraded={false} />;
    case 'practice-ungraded-one-card':
      return <PracticeOneCardSummaryFixture ungraded={true} />;
    case 'practice-deferred':
      return <DeferredPracticeFixture />;
    case 'sentence-practice':
      return <SentencePracticeFixture />;
    case 'synonym-practice':
      return <SynonymPracticeFixture />;
    case 'practice-other-wording':
      return <OtherWordingFixture />;
    default:
      return state satisfies never;
  }
};
