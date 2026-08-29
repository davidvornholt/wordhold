import { useState } from 'react';
import { HomeShell } from '../src/app/home-shell';
import { CourseGrid } from '../src/features/dashboard/ui/course-grid';
import { FragileList } from '../src/features/dashboard/ui/fragile-list';
import { AudioRecoveryPages } from '../src/features/import/ui/audio-recovery-pages';
import { PendingPages } from '../src/features/import/ui/pending-pages';
import { audioRecoveryIsComplete, navigateToFixture } from './fixture-state';

const course = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'English A2',
  targetLanguage: 'en' as const,
};
const fixtureReviewsToday = 7;
const fixtureDue = 4;
const fixtureFresh = 2;
const fixtureUnlearned = 6;
const fixtureEntries = 18;
const recoveryPage = {
  id: '00000000-0000-0000-0000-000000000003',
  courseName: course.name,
  label: 'Unit 3',
  missingAudio: 1,
  verifiedAt: new Date('2026-08-24T12:00:00Z'),
};
const pendingPage = {
  id: '00000000-0000-0000-0000-000000000004',
  courseName: course.name,
  label: 'Unit 4, Seite 73',
  capturedAt: new Date('2026-08-24T13:00:00Z'),
};

const action = (
  label: string,
  destination: 'course' | 'import' | 'practice',
) => (
  <button
    className="text-sm underline"
    onClick={() => navigateToFixture(destination)}
    type="button"
  >
    {label}
  </button>
);

export const SignedOutFixture = () => (
  <HomeShell
    onSignIn={() => navigateToFixture('dashboard')}
    onSignOut={() => undefined}
    signedIn={false}
  >
    {null}
  </HomeShell>
);

export const DashboardFixture = ({
  empty = false,
  audioRecovery = false,
  pending = false,
}) => {
  const [pendingPages, setPendingPages] = useState(
    pending ? [pendingPage] : [],
  );

  return (
    <HomeShell
      onSignIn={() => undefined}
      onSignOut={() => navigateToFixture('signed-out')}
      signedIn={true}
    >
      <CourseGrid
        courses={[course]}
        renderCourseLink={() => action(course.name, 'course')}
        renderImportAction={() =>
          action('fotografiere die erste Seite', 'import')
        }
        renderPracticeAction={() => action('Üben', 'practice')}
        reviewsToday={empty ? 0 : fixtureReviewsToday}
        stats={[
          {
            courseId: course.id,
            due: empty ? 0 : fixtureDue,
            fresh: empty ? 0 : fixtureFresh,
            unlearned: empty ? 0 : fixtureUnlearned,
            entries: empty ? 0 : fixtureEntries,
          },
        ]}
      />
      <FragileList
        entries={
          empty
            ? []
            : [
                {
                  entryId: '00000000-0000-0000-0000-000000000002',
                  targetText: 'memory',
                  nativeText: 'Erinnerung',
                  courseName: 'English A2',
                  failures: 2,
                },
              ]
        }
      />
      <AudioRecoveryPages
        pages={
          audioRecovery && !audioRecoveryIsComplete() ? [recoveryPage] : []
        }
        renderPageAction={(_page, label) => (
          <a
            className="text-sm underline"
            href="/?state=verification-audio-recovery"
          >
            {label}
          </a>
        )}
      />
      <PendingPages
        onDiscard={async (page) =>
          setPendingPages((current) =>
            current.filter((candidate) => candidate.id !== page.id),
          )
        }
        pages={pendingPages}
        renderPageAction={(_page, label) => (
          <button className="text-sm underline" type="button">
            {label}
          </button>
        )}
      />
    </HomeShell>
  );
};
