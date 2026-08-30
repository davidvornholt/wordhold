import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { HomeShell } from '../app/home-shell';
import { getDashboard } from '../features/dashboard/services/server-fns';
import { CourseGrid } from '../features/dashboard/ui/course-grid';
import { FragileList } from '../features/dashboard/ui/fragile-list';
import {
  discardImportSession,
  listAudioRecoveryPages,
  listCourses,
  listPendingImportSessions,
} from '../features/import/server-fns';
import { clearUploadQueueIfSession } from '../features/import/services/upload-queue-persistence';
import { AudioRecoveryPages } from '../features/import/ui/audio-recovery-pages';
import { PendingImportSessions } from '../features/import/ui/pending-import-sessions';
import { authClient } from '../shared/auth/client';
import { getSessionUser } from '../shared/auth/session-fn';

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
      signedIn={user !== null && dashboard !== null}
    >
      {dashboard === null ? null : (
        <>
          <CourseGrid
            courses={courses}
            renderCourseLink={(course) => (
              <Link
                className="font-medium underline"
                params={{ courseId: course.id }}
                to="/courses/$courseId"
              >
                {course.name}
              </Link>
            )}
            renderImportAction={(course) => (
              <Link
                className="border border-input px-4 py-3 text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                params={{ courseId: course.id }}
                to="/courses/$courseId/import"
              >
                Erste Seite fotografieren
              </Link>
            )}
            renderPracticeAction={(course) => (
              <Link
                className="inline-flex min-h-11 items-center bg-primary px-4 py-2 font-medium text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                params={{ courseId: course.id }}
                to="/courses/$courseId/practice"
              >
                {dashboard.perCourse.find((item) => item.courseId === course.id)
                  ?.ready ?? 0}{' '}
                Karten üben
              </Link>
            )}
            reviewsToday={dashboard.reviewsToday}
            cardsToday={dashboard.cardsToday}
            stats={dashboard.perCourse}
          />

          <FragileList
            entries={dashboard.fragile}
            renderEntryAction={(entry) => (
              <Link
                className="font-medium underline underline-offset-4"
                params={{ courseId: entry.courseId }}
                search={{ filter: 'difficult' }}
                to="/courses/$courseId/vocabulary"
              >
                {entry.targetText} · {entry.nativeText}
              </Link>
            )}
          />

          <AudioRecoveryPages
            pages={audioRecovery}
            renderPageAction={(page, label) => (
              <Link
                className="text-sm underline"
                params={{ pageId: page.id }}
                to="/pages/$pageId/verify"
              >
                {label}
              </Link>
            )}
          />

          <PendingImportSessions
            onDiscard={async (session) => {
              await discardImportSession({ data: session.id });
              await clearUploadQueueIfSession(session.courseId, session.id);
              await router.invalidate({ sync: true });
            }}
            renderSessionAction={(session, label) =>
              session.isComplete ? (
                <Link
                  aria-label={`${label} fortsetzen`}
                  className="inline-flex min-h-11 items-center bg-primary px-4 py-2 font-medium text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                  params={{ sessionId: session.id }}
                  to="/imports/$sessionId"
                >
                  Stapel fortsetzen
                </Link>
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
