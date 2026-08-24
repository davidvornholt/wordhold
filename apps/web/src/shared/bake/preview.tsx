type BakePreviewProps = {
  themeName: string;
  themeClass: string;
};

const stats = [
  { label: 'Due today', value: '24' },
  { label: 'New available', value: '12' },
  { label: 'Fragile words', value: '5' },
] as const;

const courses = [
  { name: 'English · Green Line 5', due: 14, fresh: 6 },
  { name: 'French · Découvertes 3', due: 7, fresh: 4 },
  { name: 'Spanish · ¡Vamos! 2', due: 3, fresh: 2 },
] as const;

// One representative screen rendered under both bake-off themes: dashboard
// stats, course list, and a practice card with a typed answer.
export const BakePreview = ({ themeName, themeClass }: BakePreviewProps) => (
  <div className={`${themeClass} min-h-screen`}>
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="border-border border-b pb-6">
        <p className="text-muted-foreground text-sm uppercase tracking-widest">
          Bake-off · {themeName}
        </p>
        <h1 className="mt-2 font-display text-4xl">Wordhold</h1>
        <p className="mt-1 text-muted-foreground">From page to memory.</p>
      </header>

      <section className="mt-8 grid grid-cols-3 gap-px">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border border-border bg-card p-4 text-center"
          >
            <p className="font-display text-3xl">{stat.value}</p>
            <p className="mt-1 text-muted-foreground text-xs">{stat.label}</p>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl">Courses</h2>
        <ul className="mt-3 divide-y divide-(--border) border-border border-y">
          {courses.map((course) => (
            <li
              key={course.name}
              className="flex items-baseline justify-between py-3"
            >
              <span>{course.name}</span>
              <span className="text-muted-foreground text-sm">
                {course.due} due · {course.fresh} new
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 border border-border bg-card p-6">
        <p className="text-muted-foreground text-xs uppercase tracking-widest">
          Translate to French
        </p>
        <p className="mt-3 font-display text-2xl">die Erinnerung</p>
        <input
          className="mt-6 w-full border-input border-b bg-transparent pb-2 outline-none focus:border-ring"
          placeholder="Deine Antwort …"
          type="text"
        />
        <div className="mt-6 flex items-center justify-between">
          <button
            className="text-muted-foreground text-sm underline underline-offset-4"
            type="button"
          >
            Antwort zeigen
          </button>
          <button
            className="bg-primary px-5 py-2 font-medium text-primary-foreground"
            type="button"
          >
            Prüfen
          </button>
        </div>
      </section>

      <section className="mt-8 flex items-center gap-3">
        <span className="bg-accent px-2 py-1 text-accent-foreground text-xs">
          le souvenir · akzeptiert
        </span>
        <span className="bg-destructive px-2 py-1 text-destructive-foreground text-xs">
          la mémoire · falscher Kontext
        </span>
      </section>
    </div>
  </div>
);
