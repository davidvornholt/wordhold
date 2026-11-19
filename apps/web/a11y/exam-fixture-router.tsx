import { freshExam, practisedExam } from './exam-fixture-data';
import { ExamFixture, NewExamFixture } from './exam-fixtures';
import type { FixtureState } from './fixture-state';

// One test's standing and the form.
const examStates = [
  'exam',
  'exam-fresh',
  'exam-new',
] as const satisfies ReadonlyArray<FixtureState>;

type ExamState = (typeof examStates)[number];

export const isExamState = (state: FixtureState): state is ExamState =>
  (examStates as ReadonlyArray<FixtureState>).includes(state);

export const examFixture = (state: ExamState) => {
  switch (state) {
    case 'exam':
      return <ExamFixture exam={practisedExam} />;
    case 'exam-fresh':
      return <ExamFixture exam={freshExam} />;
    case 'exam-new':
      return <NewExamFixture />;
    default:
      return state satisfies never;
  }
};
