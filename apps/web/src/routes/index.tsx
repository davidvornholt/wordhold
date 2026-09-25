import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { HomeShell } from '../app/home-shell';
import {
  busiestCourse,
  type DashboardData,
  todayActionLabel,
  totalReady,
} from '../features/dashboard/schemas/dashboard-models';
import { getDashboard } from '../features/dashboard/services/server-fns';
import { CourseGrid } from '../features/dashboard/ui/course-grid';
import { FragileList } from '../features/dashboard/ui/fragile-list';
import { TodayPanel } from '../features/dashboard/ui/today-panel';
import {
  discardImportSession,
  listAudioRecoveryPages,
  listCourses,
  listPendingImportSessions,
  retryAudio,
} from '../features/import/server-fns';
import { clearUploadQueueIfSession } from '../features/import/services/upload-queue-persistence';
import { AudioRecoveryPages } from '../features/import/ui/audio-recovery-pages';
import { PendingImportSessions } from '../features/import/ui/pending-import-sessions';
import { authClient } from '../shared/auth/client';
import { getSessionUser } from '../shared/auth/session-fn';
import { earliestDate } from '../shared/dates/learning-date';
import { countNoun } from '../shared/format/count';
import { ActionLink } from '../shared/ui/action-link';

const courseLinkClass =
  'font-display text-xl underline decoration-border underline-offset-4 transition-colors hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

type TodayProps = {
  readonly dashboard: DashboardData;
  readonly courses: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
};

// The course cards start sittings; the "Heute" action is a shortcut to the
// busiest one and says so when the total spans several courses.
const Today = ({ dashboard, courses }: TodayProps) => {
  const ready = totalReady(dashboard.perCourse);
  const busiest = busiestCourse(dashboard.perCourse);
  const busiestName = courses.find(
    (course) => course.id === busiest?.courseId,
  )?.name;
  return (
    <TodayPanel
      action={
        busiest === undefined || busiestName === undefined ? null : (
          <ActionLink
            params={{ courseId: busiest.courseId }}
            to="/courses/$courseId/practice"
          >
            {todayActionLabel(
              { name: busiestName, ready: busiest.ready },
              ready,
            )}
          </ActionLink>
        )
      }
      cardsToday={dashboard.cardsToday}
      nextDueAt={earliestDate(
        dashboard.perCourse.map((stats) => stats.nextDueAt),
      )}
      ready={ready}
      reviewsToday={dashboard.reviewsToday}
      streak={dashboard.streak}
      week={dashboard.week}
    />
  );
};

const Home = () => {
  const { user, courses, pendingImportSessions, audioRecovery, dashboard } =
    Route.useLoaderData();
  const router = useRouter();

  return (
    <HomeShell
      onSignIn={async () => {
        await authClient.signIn.social({
          provider: 'github',
          callbackURL: '/',
        });
      }}
      onSignOut={async () => {
        await authClient.signOut();
        await router.invalidate();
      }}
      user={dashboard === null ? null : user}
    >
      {dashboard === null ? null : (
        <>
          <Today courses={courses} dashboard={dashboard} />

          <CourseGrid
            courses={courses}
            renderCourseLink={(course) => (
              <Link
                className={courseLinkClass}
                params={{ courseId: course.id }}
                to="/courses/$courseId"
              >
                {course.name}
              </Link>
            )}
            renderImportAction={(course) => (
              <ActionLink
                params={{ courseId: course.id }}
                to="/courses/$courseId/import"
              >
                Erste Seite fotografieren
              </ActionLink>
            )}
            renderLearnAction={(course) => (
              <ActionLink
                params={{ courseId: course.id }}
                to="/courses/$courseId"
                variant="outline"
              >
                Neue Vokabeln kennenlernen
              </ActionLink>
            )}
            renderPracticeAction={(course) => (
              <ActionLink
                params={{ courseId: course.id }}
                to="/courses/$courseId/practice"
                variant="outline"
              >
                {countNoun(
                  dashboard.perCourse.find(
                    (item) => item.courseId === course.id,
                  )?.ready ?? 0,
                  'Karte',
                  'Karten',
                )}{' '}
                üben
              </ActionLink>
            )}
            stats={dashboard.perCourse}
          />

          <FragileList
            entries={dashboard.fragile}
            renderEntryAction={(entry) => (
              <Link
                className="font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                params={{ courseId: entry.courseId }}
                search={{ filter: 'difficult' }}
                to="/courses/$courseId/vocabulary"
              >
                {entry.targetText} · {entry.nativeText}
              </Link>
            )}
          />

          <AudioRecoveryPages
            onRecovered={() => router.invalidate({ sync: true })}
            onRetry={(page) => retryAudio({ data: page.id })}
            pages={audioRecovery}
          />

          <PendingImportSessions
            onDiscard={async (session) => {
              await discardImportSession({ data: session.id });
              await clearUploadQueueIfSession(session.courseId, session.id);
              await router.invalidate({ sync: true });
            }}
            renderSessionAction={(session, label) =>
              session.isComplete ? (
                <ActionLink
                  aria-label={`${label} fortsetzen`}
                  params={{ sessionId: session.id }}
                  to="/imports/$sessionId/review"
                >
                  Stapel fortsetzen
                </ActionLink>
              ) : (
                <span className="text-muted-foreground text-sm">
                  Verarbeitung läuft …
                </span>
              )
            }
            sessions={pendingImportSessions}
          />
        </>
      )}
    </HomeShell>
  );
};

export const Route = createFileRoute('/')({
  loader: async () => {
    const user = await getSessionUser();
    if (user === null) {
      return {
        user: null,
        courses: [],
        pendingImportSessions: [],
        audioRecovery: [],
        dashboard: null,
      } as const;
    }
    const [courses, pendingImportSessions, audioRecovery, dashboard] =
      await Promise.all([
        listCourses(),
        listPendingImportSessions(),
        listAudioRecoveryPages(),
        getDashboard(),
      ]);
    return {
      user,
      courses,
      pendingImportSessions,
      audioRecovery,
      dashboard,
    } as const;
  },
  component: Home,
});
