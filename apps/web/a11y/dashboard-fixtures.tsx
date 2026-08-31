import { useState } from 'react';
import { HomeShell } from '../src/app/home-shell';
import { CourseGrid } from '../src/features/dashboard/ui/course-grid';
import { FragileList } from '../src/features/dashboard/ui/fragile-list';
import { AudioRecoveryPages } from '../src/features/import/ui/audio-recovery-pages';
import { PendingImportSessions } from '../src/features/import/ui/pending-import-sessions';
import { audioRecoveryIsComplete, navigateToFixture } from './fixture-state';

const course = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'English A2',
  targetLanguage: 'en' as const,
};
const fixtureReviewsToday = 7;
const fixtureCardsToday = 5;
const fixtureDue = 0;
const fixtureFirstReviews = 6;
const fixtureUnintroduced = 6;
const fixtureEntries = 18;
const recoveryPage = {
  id: '00000000-0000-0000-0000-000000000003',
  courseName: course.name,
  missingAudio: 1,
  verifiedAt: new Date('2026-08-24T12:00:00Z'),
};
const pendingImportSession = {
  id: '00000000-0000-0000-0000-000000000004',
  courseId: course.id,
  courseName: course.name,
  capturedAt: new Date('2026-08-24T13:00:00Z'),
  pageCount: 3,
  uploadedCount: 3,
  verifiedCount: 0,
  pendingCount: 3,
  isComplete: true,
};

const actionClass = (destination: 'course' | 'import' | 'practice') => {
  if (destination === 'practice') {
    return 'inline-flex min-h-11 items-center bg-primary px-4 py-2 font-medium text-primary-foreground text-sm';
  }
  if (destination === 'import') {
    return 'min-h-11 border border-input px-4 py-2 text-sm underline-offset-4 hover:underline';
  }
  return 'font-medium underline';
};

const action = (
  label: string,
  destination: 'course' | 'import' | 'practice',
) => (
  <button
    className={actionClass(destination)}
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

const dashboardStats = (empty: boolean) => [
  {
    courseId: course.id,
    due: empty ? 0 : fixtureDue,
    firstReviews: empty ? 0 : fixtureFirstReviews,
    ready: empty ? 0 : fixtureDue + fixtureFirstReviews,
    unintroduced: empty ? 0 : fixtureUnintroduced,
    entries: empty ? 0 : fixtureEntries,
    nextDueAt: empty ? null : new Date('2026-08-30T10:40:00Z'),
    directions: [
      {
        direction: 'to_target' as const,
        due: empty ? 0 : fixtureDue,
        firstReviews: empty ? 0 : fixtureFirstReviews,
        ready: empty ? 0 : fixtureDue + fixtureFirstReviews,
        nextDueAt: empty ? null : new Date('2026-08-30T10:40:00Z'),
      },
    ],
  },
];

export const DashboardFixture = ({
  empty = false,
  audioRecovery = false,
  pending = false,
}) => {
  const [pendingImportSessions, setPendingImportSessions] = useState(
    pending ? [pendingImportSession] : [],
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
        renderPracticeAction={() => action('6 Karten üben', 'practice')}
        reviewsToday={empty ? 0 : fixtureReviewsToday}
        cardsToday={empty ? 0 : fixtureCardsToday}
        stats={dashboardStats(empty)}
      />
      <FragileList
        entries={
          empty
            ? []
            : [
                {
                  entryId: '00000000-0000-0000-0000-000000000002',
                  courseId: course.id,
                  targetText: 'memory',
                  nativeText: 'Erinnerung',
                  courseName: 'English A2',
                  failures: 2,
                },
              ]
        }
        renderEntryAction={(entry) => (
          <button
            onClick={() => navigateToFixture('vocabulary-difficult')}
            type="button"
          >
            {entry.targetText} · {entry.nativeText}
          </button>
        )}
      />
      <AudioRecoveryPages
        onRecovered={async () => undefined}
        onRetry={async () => ({ pending: 1 })}
        pages={
          audioRecovery && !audioRecoveryIsComplete() ? [recoveryPage] : []
        }
      />
      <PendingImportSessions
        onDiscard={async (session) =>
          setPendingImportSessions((current) =>
            current.filter((candidate) => candidate.id !== session.id),
          )
        }
        renderSessionAction={(session, label) =>
          session.isComplete ? (
            <button
              aria-label={`${label} fortsetzen`}
              className="bg-primary px-4 py-2 text-primary-foreground text-sm"
              type="button"
            >
              Stapel fortsetzen
            </button>
          ) : (
            <span className="text-muted-foreground text-sm">
              Verarbeitung läuft …
            </span>
          )
        }
        sessions={pendingImportSessions}
      />
    </HomeShell>
  );
};
