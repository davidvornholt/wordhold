import { useState } from 'react';
import { HomeShell } from '../src/app/home-shell';
import {
  busiestCourse,
  type CourseStats,
  type PracticeDay,
  totalReady,
} from '../src/features/dashboard/schemas/dashboard-models';
import { CourseGrid } from '../src/features/dashboard/ui/course-grid';
import { FragileList } from '../src/features/dashboard/ui/fragile-list';
import { TodayPanel } from '../src/features/dashboard/ui/today-panel';
import { AudioRecoveryPages } from '../src/features/import/ui/audio-recovery-pages';
import { PendingImportSessions } from '../src/features/import/ui/pending-import-sessions';
import { AudioRecoveryPagesFixture } from './audio-recovery-pages-fixture';
import { audioRecoveryIsComplete, navigateToFixture } from './fixture-state';

const course = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'English A2',
  targetLanguage: 'en' as const,
};
const fixtureUser = { name: 'David' };
const fixtureReviewsToday = 7;
const fixtureCardsToday = 5;
const fixtureDue = 0;
const fixtureFirstReviews = 6;
const fixtureUnintroduced = 6;
const fixtureEntries = 18;
const fixtureKnown = 9;
const fixtureStreak = 4;
const millisecondsPerDay = 86_400_000;
// Relative to the real clock so the resting copy reads "morgen um …" on any
// day the suite runs.
const fixtureNextDueAt = new Date(Date.now() + millisecondsPerDay);
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

// Tuesday to Monday, with a gap on Thursday and today still open.
const fixtureWeek: ReadonlyArray<PracticeDay> = [
  { day: '2026-08-18', weekday: 2, practiced: true },
  { day: '2026-08-19', weekday: 3, practiced: true },
  { day: '2026-08-20', weekday: 4, practiced: false },
  { day: '2026-08-21', weekday: 5, practiced: true },
  { day: '2026-08-22', weekday: 6, practiced: true },
  { day: '2026-08-23', weekday: 0, practiced: true },
  { day: '2026-08-24', weekday: 1, practiced: true },
];

type FixtureAction =
  | 'course'
  | 'import'
  | 'learn'
  | 'practice'
  | 'practice-outline';

const fixtureDestination = (destination: FixtureAction) => {
  if (destination === 'practice-outline') {
    return 'practice';
  }
  return destination === 'learn' ? 'course' : destination;
};

const actionClass = (destination: FixtureAction) => {
  if (destination === 'practice' || destination === 'learn') {
    return 'inline-flex min-h-11 items-center bg-primary px-4 py-2 font-medium text-primary-foreground text-sm';
  }
  if (destination === 'practice-outline' || destination === 'import') {
    return 'inline-flex min-h-11 items-center border border-input px-4 py-2 text-sm underline-offset-4 hover:underline';
  }
  return 'font-display text-xl underline decoration-border underline-offset-4 hover:decoration-current';
};

const action = (label: string, destination: FixtureAction) => (
  <button
    className={actionClass(destination)}
    onClick={() => navigateToFixture(fixtureDestination(destination))}
    type="button"
  >
    {label}
  </button>
);

export const SignedOutFixture = () => (
  <HomeShell
    onSignIn={() => navigateToFixture('dashboard')}
    onSignOut={() => undefined}
    user={null}
  >
    {null}
  </HomeShell>
);

const dashboardStats = (
  empty: boolean,
  resting: boolean,
): ReadonlyArray<CourseStats> => [
  {
    courseId: course.id,
    due: empty ? 0 : fixtureDue,
    firstReviews: empty || resting ? 0 : fixtureFirstReviews,
    ready: empty || resting ? 0 : fixtureDue + fixtureFirstReviews,
    unintroduced: empty ? 0 : fixtureUnintroduced,
    entries: empty ? 0 : fixtureEntries,
    known: empty ? 0 : fixtureKnown,
    nextDueAt: empty ? null : fixtureNextDueAt,
    directions: [
      {
        direction: 'to_target' as const,
        due: empty ? 0 : fixtureDue,
        firstReviews: empty || resting ? 0 : fixtureFirstReviews,
        ready: empty || resting ? 0 : fixtureDue + fixtureFirstReviews,
        nextDueAt: empty ? null : fixtureNextDueAt,
      },
    ],
  },
];

export const DashboardFixture = ({
  empty = false,
  audioRecovery = false,
  pending = false,
  resting = false,
}) => {
  const queueRecovery =
    new URLSearchParams(globalThis.location.search).get('queue') === 'true';
  const [pendingImportSessions, setPendingImportSessions] = useState(
    pending ? [pendingImportSession] : [],
  );
  const stats = dashboardStats(empty, resting);
  const busiest = busiestCourse(stats);

  return (
    <HomeShell
      onSignIn={() => undefined}
      onSignOut={() => navigateToFixture('signed-out')}
      user={fixtureUser}
    >
      <TodayPanel
        action={busiest === undefined ? null : action('Jetzt üben', 'practice')}
        cardsToday={empty ? 0 : fixtureCardsToday}
        nextDueAt={stats[0]?.nextDueAt ?? null}
        ready={totalReady(stats)}
        reviewsToday={empty ? 0 : fixtureReviewsToday}
        streak={empty ? 0 : fixtureStreak}
        week={
          empty
            ? fixtureWeek.map((day) => ({ ...day, practiced: false }))
            : fixtureWeek
        }
      />
      <CourseGrid
        courses={[course]}
        renderCourseLink={() => action(course.name, 'course')}
        renderImportAction={() =>
          action('fotografiere die erste Seite', 'import')
        }
        renderLearnAction={() => action('Neue Vokabeln kennenlernen', 'learn')}
        renderPracticeAction={() => action('6 Karten üben', 'practice-outline')}
        stats={stats}
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
      {queueRecovery ? (
        <AudioRecoveryPagesFixture />
      ) : (
        <AudioRecoveryPages
          onRecovered={async () => undefined}
          onRetry={async () => ({ pending: 1 })}
          pages={
            audioRecovery && !audioRecoveryIsComplete() ? [recoveryPage] : []
          }
        />
      )}
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
