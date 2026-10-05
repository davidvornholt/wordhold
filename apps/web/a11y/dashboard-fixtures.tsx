import type { CourseKind } from '@wordhold/db/schema/courses';
import { useRef, useState } from 'react';
import { HomeShell } from '../src/app/home-shell';
import { NewSubjectDialog } from '../src/features/courses/ui/new-subject-dialog';
import {
  busiestCourse,
  type CourseStats,
  type PracticeDay,
  todayActionLabel,
  totalReady,
} from '../src/features/dashboard/schemas/dashboard-models';
import { CourseGrid } from '../src/features/dashboard/ui/course-grid';
import { FragileList } from '../src/features/dashboard/ui/fragile-list';
import { TodayPanel } from '../src/features/dashboard/ui/today-panel';
import { AudioRecoveryPages } from '../src/features/import/ui/audio-recovery-pages';
import { PendingImportSessions } from '../src/features/import/ui/pending-import-sessions';
import { type CourseSubject, courseNouns } from '../src/shared/directions';
import { actionClass } from '../src/shared/ui/action-styles';
import { AudioRecoveryPagesFixture } from './audio-recovery-pages-fixture';
import {
  collection,
  collectionStats,
  course,
  fixtureNextDueAt,
  fragileTerm,
  fragileWord,
  secondCourse,
  secondCourseStats,
  subject,
  subjectStats,
} from './dashboard-fixture-data';
import { fixtureControl } from './fixture-controls';
import {
  audioRecoveryIsComplete,
  type FixtureState,
  navigateToFixture,
} from './fixture-state';

const fixtureUser = { name: 'David' };
const fixtureReviewsToday = 7;
const fixtureCardsToday = 5;
const fixtureDue = 0;
const fixtureFirstReviews = 6;
const fixtureUnintroduced = 6;
const fixtureEntries = 18;
const fixtureKnown = 9;
const fixtureStreak = 4;
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

// A second batch for `&batches=2`, so one can be discarded while another
// stays open.
const laterPendingImportSession = {
  ...pendingImportSession,
  id: '00000000-0000-0000-0000-000000000005',
  capturedAt: new Date('2026-08-25T13:00:00Z'),
  pageCount: 2,
  uploadedCount: 2,
  pendingCount: 2,
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

const fixtureDestinations = {
  course: 'course',
  collection: 'texts-course',
  'collection-learn': 'texts-learn',
  fragile: 'study-start',
  import: 'import',
  learn: 'course',
  practice: 'practice',
  today: 'practice',
  subject: 'terms-course',
  'subject-start': 'terms-course-empty',
} as const satisfies Record<string, FixtureState>;

type FixtureAction = keyof typeof fixtureDestinations;

const courseDestinations = {
  language: 'course',
  terms: 'subject',
  texts: 'collection',
} as const satisfies Record<CourseKind, FixtureAction>;

// The fixture mirrors the variants the dashboard route gives each action.
const fixtureActionClass = (destination: FixtureAction) => {
  if (
    destination === 'course' ||
    destination === 'subject' ||
    destination === 'collection'
  ) {
    return 'font-display text-xl underline decoration-border underline-offset-4 hover:decoration-current';
  }
  return actionClass(
    destination === 'today' ||
      destination === 'import' ||
      destination === 'subject-start'
      ? 'primary'
      : 'outline',
  );
};

const action = (label: string, destination: FixtureAction) => (
  <button
    className={fixtureActionClass(destination)}
    onClick={() => navigateToFixture(fixtureDestinations[destination])}
    type="button"
  >
    {label}
  </button>
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

type FixtureCourse = CourseSubject & {
  readonly id: string;
  readonly name: string;
};

// The first course is always there; the others join for their states.
const fixtureCourseList = ({
  empty,
  resting,
  twoCourses,
  subjects,
}: {
  readonly empty: boolean;
  readonly resting: boolean;
  readonly twoCourses: boolean;
  readonly subjects: boolean;
}) => ({
  courses: [
    course,
    ...(twoCourses ? [secondCourse] : []),
    ...(subjects ? [subject, collection] : []),
  ] satisfies ReadonlyArray<FixtureCourse>,
  stats: [
    ...dashboardStats(empty, resting),
    ...(twoCourses ? [secondCourseStats] : []),
    ...(subjects ? [subjectStats, collectionStats] : []),
  ],
});

type FixtureCoursesProps = {
  readonly courses: ReadonlyArray<FixtureCourse>;
  readonly stats: ReadonlyArray<CourseStats>;
  readonly empty: boolean;
  readonly subjects: boolean;
};

// The course cards with the subject form below them, then the words and
// terms that failed most often.
const FixtureCourses = ({
  courses,
  stats,
  empty,
  subjects,
}: FixtureCoursesProps) => (
  <>
    <CourseGrid
      courses={courses}
      renderCourseLink={(candidate) =>
        action(candidate.name, courseDestinations[candidate.kind])
      }
      renderLearnAction={(candidate) =>
        action(
          `Neue ${courseNouns(candidate).plural} kennenlernen`,
          candidate.kind === 'texts' ? 'collection-learn' : 'learn',
        )
      }
      renderPracticeAction={(candidate) =>
        action(
          `${stats.find((item) => item.courseId === candidate.id)?.ready ?? 0} Karten üben`,
          'practice',
        )
      }
      renderStartAction={(candidate) =>
        candidate.kind === 'terms'
          ? action('Ersten Begriff eintragen', 'subject-start')
          : action('Erste Seite fotografieren', 'import')
      }
      stats={stats}
      renderNewSubjectAction={(kind) => (
        <NewSubjectDialog
          courses={courses}
          createSubject={async () =>
            navigateToFixture(
              kind === 'terms' ? 'terms-course-empty' : 'texts-course-empty',
            )
          }
          kind={kind}
        />
      )}
    />
    <FragileList
      entries={empty ? [] : [fragileWord, ...(subjects ? [fragileTerm] : [])]}
      renderPracticeAction={(_group, label) => action(label, 'fragile')}
    />
  </>
);

export const DashboardFixture = ({
  empty = false,
  audioRecovery = false,
  pending = false,
  resting = false,
  twoCourses = false,
  subjects = false,
}) => {
  const todayHeadingRef = useRef<HTMLHeadingElement>(null);
  const search = new URLSearchParams(globalThis.location.search);
  const queueRecovery = search.get('queue') === 'true';
  const [pendingImportSessions, setPendingImportSessions] = useState(() => {
    if (!pending) {
      return [];
    }
    return search.get('batches') === '2'
      ? [pendingImportSession, laterPendingImportSession]
      : [pendingImportSession];
  });
  const { courses, stats } = fixtureCourseList({
    empty,
    resting,
    twoCourses,
    subjects,
  });
  const ready = totalReady(stats);
  const busiest = busiestCourse(stats);
  const busiestName = courses.find(
    (candidate) => candidate.id === busiest?.courseId,
  )?.name;

  return (
    <HomeShell
      accountLinks={fixtureControl('Passkeys', 'passkeys', 'quiet-muted')}
      onSignOut={() => navigateToFixture('signed-out')}
      signIn={null}
      user={fixtureUser}
    >
      <TodayPanel
        action={
          busiest === undefined || busiestName === undefined
            ? null
            : action(
                todayActionLabel(
                  { name: busiestName, ready: busiest.ready },
                  ready,
                ),
                'today',
              )
        }
        cardsToday={empty ? 0 : fixtureCardsToday}
        headingRef={todayHeadingRef}
        nextDueAt={stats[0]?.nextDueAt ?? null}
        ready={ready}
        reviewsToday={empty ? 0 : fixtureReviewsToday}
        streak={empty ? 0 : fixtureStreak}
        week={
          empty
            ? fixtureWeek.map((day) => ({ ...day, practiced: false }))
            : fixtureWeek
        }
      />
      <FixtureCourses
        courses={courses}
        empty={empty}
        stats={stats}
        subjects={subjects}
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
        fallbackFocusRef={todayHeadingRef}
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
