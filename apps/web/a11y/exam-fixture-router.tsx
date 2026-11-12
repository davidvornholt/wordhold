import { archivedExam, freshExam, practisedExam } from './exam-fixture-data';
import { ArchiveFixture, ExamFixture, NewExamFixture } from './exam-fixtures';
import type { FixtureState } from './fixture-state';

// A course's archived tests, one test's standing and the form.
const examStates = [
  'exams-archive',
  'exam',
  'exam-fresh',
  'exam-archived',
  'exam-new',
] as const satisfies ReadonlyArray<FixtureState>;

type ExamState = (typeof examStates)[number];

export const isExamState = (state: FixtureState): state is ExamState =>
  (examStates as ReadonlyArray<FixtureState>).includes(state);

export const examFixture = (state: ExamState) => {
  switch (state) {
    case 'exams-archive':
      return <ArchiveFixture />;
    case 'exam':
      return <ExamFixture exam={practisedExam} />;
    case 'exam-fresh':
      return <ExamFixture exam={freshExam} />;
    case 'exam-archived':
      return <ExamFixture exam={archivedExam} />;
    case 'exam-new':
      return <NewExamFixture />;
    default:
      return state satisfies never;
  }
};
