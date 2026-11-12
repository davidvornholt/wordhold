import { listItemNameClass } from '../src/features/courses/ui/list-item-name-styles';
import type { ExamDetail } from '../src/features/exams/schemas/exam-models';
import { ExamForm } from '../src/features/exams/ui/exam-form';
import { ExamList } from '../src/features/exams/ui/exam-list';
import { ExamOverview } from '../src/features/exams/ui/exam-overview';
import { Button } from '../src/shared/ui/button';
import { PageLayout } from '../src/shared/ui/page-layout';
import { englishSubject } from './course-fixture-data';
import { courseEntries, examSummaries } from './exam-fixture-data';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';

const courseName = 'English A2';

export const ExamsFixture = ({ empty }: { readonly empty: boolean }) => (
  <PageLayout
    backControl={fixtureBackControl(courseName, 'course')}
    title={`${courseName}: Tests`}
  >
    {fixtureControl('Test anlegen', 'exam-new', empty ? 'primary' : 'outline')}
    <ExamList
      exams={empty ? [] : examSummaries}
      renderExamLink={(exam) => (
        <button
          className={listItemNameClass}
          onClick={() => navigateToFixture('exam')}
          type="button"
        >
          {exam.name}
        </button>
      )}
      subject={englishSubject}
    />
  </PageLayout>
);

export const ExamFixture = ({ exam }: { readonly exam: ExamDetail }) => (
  <PageLayout
    backControl={fixtureBackControl('Tests', 'exams')}
    title={exam.name}
  >
    <ExamOverview
      exam={exam}
      learnAction={fixtureControl(
        'Jetzt kennenlernen',
        'learn-start',
        'outline',
      )}
      manageActions={
        <>
          {fixtureControl('Bearbeiten', 'exam-new', 'quiet')}
          <Button variant="quiet">Archivieren</Button>
        </>
      }
      practiceMissedAction={fixtureControl(
        'Diese Fehler üben',
        'study-session',
        'outline',
      )}
      roundAction={
        exam.openRound === null ? (
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
        )
      }
      subject={englishSubject}
    />
  </PageLayout>
);

// The course learns only one way round, so the form says that the test's
// other direction is not learned.
export const NewExamFixture = () => (
  <PageLayout
    backControl={fixtureBackControl('Tests', 'exams')}
    title="Test anlegen"
  >
    <ExamForm
      cancelControl={fixtureControl('Abbrechen', 'exams', 'quiet-muted')}
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
