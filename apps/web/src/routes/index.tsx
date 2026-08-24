import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { authClient } from '../shared/auth/client';
import { getSessionUser } from '../shared/auth/session-fn';
import { CourseCard } from '../shared/dashboard/course-card';
import { FragileList } from '../shared/dashboard/fragile-list';
import { getDashboard } from '../shared/dashboard/stats-fn';
import { listCourses, listPendingPages } from '../shared/import/server-fns';

const SignedOut = () => (
  <div className="flex flex-col items-start gap-4">
    <p className="text-neutral-600 text-sm">
      Melde dich an, um deine Kurse zu sehen.
    </p>
    <button
      className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
      onClick={async () => {
        await authClient.signIn.social({
          provider: 'github',
          callbackURL: '/',
        });
      }}
      type="button"
    >
      Mit GitHub anmelden
    </button>
  </div>
);

const Home = () => {
  const { user, courses, pending, dashboard } = Route.useLoaderData();
  const router = useRouter();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-semibold text-2xl">Wordhold</h1>
          <p className="text-neutral-500 text-sm" lang="en">
            From page to memory.
          </p>
        </div>
        {user === null ? null : (
          <button
            className="text-neutral-500 text-sm underline"
            onClick={async () => {
              await authClient.signOut();
              await router.invalidate();
            }}
            type="button"
          >
            Abmelden
          </button>
        )}
      </header>

      {user === null || dashboard === null ? (
        <SignedOut />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-medium text-lg">Kurse</h2>
              {dashboard.reviewsToday > 0 ? (
                <p className="text-neutral-500 text-sm">
                  Heute {dashboard.reviewsToday} Antworten geübt.
                </p>
              ) : null}
            </div>
            <ul className="grid gap-3 sm:grid-cols-3">
              {courses.map((course) => (
                <CourseCard
                  course={course}
                  key={course.id}
                  stats={dashboard.perCourse.find(
                    (stats) => stats.courseId === course.id,
                  )}
                />
              ))}
            </ul>
          </section>

          <FragileList words={dashboard.fragile} />

          <section className="flex flex-col gap-3">
            <h2 className="font-medium text-lg">Seiten zur Überprüfung</h2>
            {pending.length === 0 ? (
              <p className="text-neutral-500 text-sm">
                Keine Seiten warten auf Überprüfung.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {pending.map((page) => (
                  <li key={page.id}>
                    <Link
                      className="text-sm underline"
                      params={{ pageId: page.id }}
                      to="/pages/$pageId/verify"
                    >
                      {page.courseName}
                      {page.label === null ? '' : ` – ${page.label}`} (
                      {new Date(page.capturedAt).toLocaleDateString('de-DE')})
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <nav className="flex gap-4 border-neutral-200 border-t pt-4">
        <Link
          className="text-neutral-400 text-xs underline"
          to="/bake/heirloom"
        >
          Bake-off: Heirloom
        </Link>
        <Link
          className="text-neutral-400 text-xs underline"
          to="/bake/warm-print"
        >
          Bake-off: Warm Print
        </Link>
      </nav>
    </main>
  );
};

export const Route = createFileRoute('/')({
  loader: async () => {
    const user = await getSessionUser();
    if (user === null) {
      return { user: null, courses: [], pending: [], dashboard: null } as const;
    }
    const [courses, pending, dashboard] = await Promise.all([
      listCourses(),
      listPendingPages(),
      getDashboard(),
    ]);
    return { user, courses, pending, dashboard } as const;
  },
  component: Home,
});
