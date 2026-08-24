import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { HomeShell } from '../app/home-shell';
import { getDashboard } from '../features/dashboard/services/server-fns';
import { CourseGrid } from '../features/dashboard/ui/course-grid';
import { FragileList } from '../features/dashboard/ui/fragile-list';
import {
  listAudioRecoveryPages,
  listCourses,
  listPendingPages,
} from '../features/import/server-fns';
import { AudioRecoveryPages } from '../features/import/ui/audio-recovery-pages';
import { PendingPages } from '../features/import/ui/pending-pages';
import { authClient } from '../shared/auth/client';
import { getSessionUser } from '../shared/auth/session-fn';

const Home = () => {
  const { user, courses, pending, audioRecovery, dashboard } =
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
            renderImportAction={(course) => (
              <Link
                className="text-sm underline"
                params={{ courseId: course.id }}
                to="/courses/$courseId/import"
              >
                Seite fotografieren
              </Link>
            )}
            renderPracticeAction={(course) => (
              <Link
                className="font-medium text-sm underline"
                params={{ courseId: course.id }}
                to="/courses/$courseId/practice"
              >
                Üben
              </Link>
            )}
            reviewsToday={dashboard.reviewsToday}
            stats={dashboard.perCourse}
          />

          <FragileList words={dashboard.fragile} />

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

          <PendingPages
            pages={pending}
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
        pending: [],
        audioRecovery: [],
        dashboard: null,
      } as const;
    }
    const [courses, pending, audioRecovery, dashboard] = await Promise.all([
      listCourses(),
      listPendingPages(),
      listAudioRecoveryPages(),
      getDashboard(),
    ]);
    return { user, courses, pending, audioRecovery, dashboard } as const;
  },
  component: Home,
});
