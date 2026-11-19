import { PencilIcon } from 'lucide-react';
import { listItemNameClass } from '../src/features/courses/ui/list-item-name-styles';
import type {
  ExamDetail,
  ExamSummary,
} from '../src/features/exams/schemas/exam-models';
import { ExamForm } from '../src/features/exams/ui/exam-form';
import { ExamSection } from '../src/features/exams/ui/exam-list';
import { ExamOverview } from '../src/features/exams/ui/exam-overview';
import type { CourseSubject } from '../src/shared/directions';
import { Button } from '../src/shared/ui/button';
import { PageLayout } from '../src/shared/ui/page-layout';
import { englishSubject } from './course-fixture-data';
import { courseEntries } from './exam-fixture-data';
import {
  fixtureBackControl,
  fixtureControl,
  fixtureIconControl,
} from './fixture-controls';
import { navigateToFixture } from './fixture-state';

const courseName = 'English A2';

const examLink = (exam: ExamSummary) => (
  <button
    className={listItemNameClass}
    onClick={() => navigateToFixture('exam')}
    type="button"
  >
    {exam.name}
  </button>
);

// The tests section of a course's page.
export const FixtureExamSection = ({
  exams,
  subject,
}: {
  readonly exams: ReadonlyArray<ExamSummary>;
  readonly subject: CourseSubject;
}) => (
  <ExamSection
    exams={exams}
    newExamAction={fixtureControl('Neuer Test', 'exam-new', 'quiet')}
    renderExamLink={examLink}
    subject={subject}
  />
);

const roundAction = (exam: ExamDetail) => (
  <div className="flex flex-wrap items-center gap-4">
    {exam.openRound === null ? (
      fixtureControl('Runde starten', 'study-session', 'primary')
    ) : (
      <>
        {fixtureControl(
          `Runde fortsetzen (${exam.openRound.answered} von ${exam.openRound.total})`,
          'study-session',
          'primary',
        )}
        <Button variant="quiet">Neu beginnen</Button>
      </>
    )}
  </div>
);

export const ExamFixture = ({ exam }: { readonly exam: ExamDetail }) => (
  <PageLayout
    backControl={fixtureBackControl(courseName, 'course')}
    title={exam.name}
    titleAction={fixtureIconControl(
      'Test bearbeiten',
      'exam-new',
      <PencilIcon aria-hidden={true} className="size-5" />,
    )}
  >
    <ExamOverview
      exam={exam}
      learnAction={
        <Button
          className="w-fit"
          onClick={() => navigateToFixture('learn-start')}
          variant="quiet"
        >
          Jetzt kennenlernen
        </Button>
      }
      practiceMissedAction={
        <Button
          className="w-fit"
          onClick={() => navigateToFixture('study-session')}
          variant="outline"
        >
          Diese Fehler üben
        </Button>
      }
      roundAction={roundAction(exam)}
      subject={englishSubject}
    />
  </PageLayout>
);

// The course learns only one way round, so the form says that the test's
// other direction is not learned.
export const NewExamFixture = () => (
  <PageLayout
    backControl={fixtureBackControl(courseName, 'course')}
    title="Neuer Test"
  >
    <ExamForm
      cancelControl={fixtureControl('Abbrechen', 'course', 'quiet-muted')}
      courseDirections={['to_target']}
      entries={courseEntries}
      initial={{
        name: '',
        directions: ['to_target', 'to_native'],
        entryIds: [],
      }}
      save={async () => navigateToFixture('exam-fresh')}
      subject={englishSubject}
      submitLabel="Test anlegen"
    />
  </PageLayout>
);
