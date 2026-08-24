import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { authClient } from '../shared/auth/client';
import { getSessionUser } from '../shared/auth/session-fn';
import { listCourses, listPendingPages } from '../shared/import/server-fns';
import { germanLabels } from '../shared/languages';

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
  const { user, courses, pending } = Route.useLoaderData();
  const router = useRouter();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-semibold text-2xl">Wordhold</h1>
          <p className="text-neutral-500 text-sm">From page to memory.</p>
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

      {user === null ? (
        <SignedOut />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="font-medium text-lg">Kurse</h2>
            <ul className="grid gap-3 sm:grid-cols-3">
              {courses.map((course) => (
                <li
                  className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4"
                  key={course.id}
                >
                  <span className="font-medium">{course.name}</span>
                  <span className="text-neutral-500 text-xs">
                    {germanLabels[course.targetLanguage]}
                  </span>
                  <Link
                    className="font-medium text-sm underline"
                    params={{ courseId: course.id }}
                    to="/courses/$courseId/practice"
                  >
                    Üben
                  </Link>
                  <Link
                    className="text-sm underline"
                    params={{ courseId: course.id }}
                    to="/courses/$courseId/import"
                  >
                    Seite fotografieren
                  </Link>
                </li>
              ))}
            </ul>
          </section>

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
      return { user: null, courses: [], pending: [] } as const;
    }
    const [courses, pending] = await Promise.all([
      listCourses(),
      listPendingPages(),
    ]);
    return { user, courses, pending } as const;
  },
  component: Home,
});
