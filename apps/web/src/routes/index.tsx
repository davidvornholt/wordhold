import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { HomeShell } from '../app/home-shell';
import { SignInPanel } from '../features/access/ui/sign-in-panel';
import { createSubject } from '../features/courses/services/server-fns';
import { NewSubjectDialog } from '../features/courses/ui/new-subject-dialog';
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
import { authClient, rejectAuthError } from '../shared/auth/client';
import { getSessionUser } from '../shared/auth/session-fn';
import { earliestDate } from '../shared/dates/learning-date';
import { type CourseSubject, courseNouns } from '../shared/directions';
import { countNoun } from '../shared/format/count';
import { ActionLink } from '../shared/ui/action-link';

const courseLinkClass =
  'font-display text-xl underline decoration-border underline-offset-4 transition-colors hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

type CourseName = {
  readonly id: string;
  readonly name: string;
};

type TodayProps = {
  readonly dashboard: DashboardData;
  readonly courses: ReadonlyArray<CourseName>;
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

type CoursesProps = {
  readonly dashboard: DashboardData;
  readonly courses: ReadonlyArray<CourseSubject & CourseName>;
};

// Each course card starts its own sittings; a new subject is created from
// below the cards and opens with its first term.
const Courses = ({ dashboard, courses }: CoursesProps) => {
  const navigate = useNavigate();
  return (
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
      renderLearnAction={(course) => (
        <ActionLink
          params={{ courseId: course.id }}
          to="/courses/$courseId"
          variant="outline"
        >
          Neue {courseNouns(course).plural} kennenlernen
        </ActionLink>
      )}
      renderPracticeAction={(course) => (
        <ActionLink
          params={{ courseId: course.id }}
          to="/courses/$courseId/practice"
          variant="outline"
        >
          {countNoun(
            dashboard.perCourse.find((item) => item.courseId === course.id)
              ?.ready ?? 0,
            'Karte',
            'Karten',
          )}{' '}
          üben
        </ActionLink>
      )}
      renderStartAction={(course) =>
        course.kind === 'terms' ? (
          <ActionLink params={{ courseId: course.id }} to="/courses/$courseId">
            Ersten Begriff eintragen
          </ActionLink>
        ) : (
          <ActionLink
            params={{ courseId: course.id }}
            to="/courses/$courseId/import"
          >
            Erste Seite fotografieren
          </ActionLink>
        )
      }
      stats={dashboard.perCourse}
      newSubjectAction={
        <NewSubjectDialog
          courses={courses}
          createSubject={async (name) => {
            const { courseId } = await createSubject({
              data: { name },
            });
            await navigate({
              to: '/courses/$courseId',
              params: { courseId },
            });
          }}
        />
      }
    />
  );
};

const Home = () => {
  const { user, courses, pendingImportSessions, audioRecovery, dashboard } =
    Route.useLoaderData();
  const router = useRouter();

  return (
    <HomeShell
      accountLinks={
        user?.admin === true ? (
          <ActionLink to="/people" variant="quiet-muted">
            Personen
          </ActionLink>
        ) : (
          <ActionLink to="/passkeys" variant="quiet-muted">
            Passkeys
          </ActionLink>
        )
      }
      onSignOut={async () => {
        await authClient.signOut();
        await router.invalidate();
      }}
      signIn={
        <SignInPanel
          joinLink={
            <ActionLink to="/join" variant="quiet">
              Einladung oder Wiederherstellungscode einlösen
            </ActionLink>
          }
          signInWithGithub={async () => {
            rejectAuthError(
              await authClient.signIn.social({
                provider: 'github',
                callbackURL: '/',
              }),
            );
          }}
          signInWithPasskey={async () => {
            rejectAuthError(await authClient.signIn.passkey());
            await router.invalidate();
          }}
        />
      }
      user={dashboard === null ? null : user}
    >
      {dashboard === null ? null : (
        <>
          <Today courses={courses} dashboard={dashboard} />

          <Courses courses={courses} dashboard={dashboard} />

          <FragileList
            entries={dashboard.fragile}
            renderPracticeAction={(group, label) => (
              <ActionLink
                params={{ courseId: group.courseId }}
                search={{
                  entries: group.entryIds.join(','),
                  mode: 'practice',
                  from: 'fragile',
                }}
                to="/courses/$courseId/study"
                variant="outline"
              >
                {label}
              </ActionLink>
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
