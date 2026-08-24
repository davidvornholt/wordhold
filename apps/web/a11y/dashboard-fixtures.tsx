import { FixtureShell } from './fixture-shell';
import { navigateToFixture } from './fixture-state';

export const SignedOutFixture = () => (
  <FixtureShell signedIn={false}>
    <div className="flex flex-col items-start gap-4">
      <p className="text-neutral-600 text-sm">
        Melde dich an, um deine Kurse zu sehen.
      </p>
      <button
        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
        onClick={() => navigateToFixture('dashboard')}
        type="button"
      >
        Mit GitHub anmelden
      </button>
    </div>
  </FixtureShell>
);

const CourseFixture = ({ empty = false }: { readonly empty?: boolean }) => (
  <li className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
    <div>
      <span className="font-medium">English A2</span>
      <p className="text-neutral-500 text-xs">Englisch</p>
    </div>
    {empty ? (
      <p className="text-neutral-500 text-sm">
        Noch keine Wörter – fotografiere die erste Seite.
      </p>
    ) : (
      <p className="flex items-baseline gap-1 text-sm">
        <span className="font-semibold text-2xl">4</span>
        <span>fällig</span>
        <span className="text-neutral-500">· 2 neu · 18 Wörter</span>
      </p>
    )}
    <div className="mt-auto flex gap-4">
      {empty ? null : (
        <button
          className="font-medium text-sm underline"
          onClick={() => navigateToFixture('practice')}
          type="button"
        >
          Üben
        </button>
      )}
      <button
        className="text-sm underline"
        onClick={() => navigateToFixture('import')}
        type="button"
      >
        Seite fotografieren
      </button>
    </div>
  </li>
);

export const DashboardFixture = ({ empty = false }) => (
  <FixtureShell>
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium text-lg">Kurse</h2>
        {empty ? null : (
          <p className="text-neutral-500 text-sm">Heute 7 Antworten geübt.</p>
        )}
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        <CourseFixture empty={empty} />
      </ul>
    </section>
    {empty ? null : (
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-lg">Noch unsichere Wörter</h2>
        <ul className="flex flex-col gap-2">
          <li className="flex items-baseline justify-between gap-4 rounded-lg border border-neutral-200 p-3">
            <div>
              <p className="font-medium">memory</p>
              <p className="text-neutral-500 text-sm">Erinnerung</p>
            </div>
            <p className="text-neutral-500 text-sm">2 Fehler · English A2</p>
          </li>
        </ul>
      </section>
    )}
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-lg">Seiten zur Überprüfung</h2>
      <p className="text-neutral-500 text-sm">
        Keine Seiten warten auf Überprüfung.
      </p>
    </section>
  </FixtureShell>
);
