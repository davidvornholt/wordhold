import { type ReactNode, type SubmitEvent, useState } from 'react';
import { navigateToFixture } from './fixture-state';

const PracticeShell = ({ children }: { readonly children: ReactNode }) => (
  <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
    <button
      className="w-fit text-neutral-500 text-sm underline"
      onClick={() => navigateToFixture('dashboard')}
      type="button"
    >
      ← Übersicht
    </button>
    <h1 className="font-semibold text-2xl">English A2: Üben</h1>
    {children}
  </main>
);

export const PracticeFixture = () => {
  const [answer, setAnswer] = useState('');
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigateToFixture('practice-feedback');
  };
  return (
    <PracticeShell>
      <p className="text-neutral-500 text-sm">
        Karte 1 von 4 · Übersetze ins Englische
      </p>
      <div className="rounded-lg border border-neutral-200 p-6">
        <p className="font-medium text-xl">Erinnerung</p>
      </div>
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <label className="flex flex-col gap-1 text-sm">
          Deine Antwort
          <input
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="rounded border border-neutral-300 px-3 py-2"
            onChange={(event) => setAnswer(event.target.value)}
            value={answer}
          />
        </label>
        <button
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={answer.trim() === ''}
          type="submit"
        >
          Prüfen
        </button>
      </form>
    </PracticeShell>
  );
};

export const PracticeFeedbackFixture = () => (
  <PracticeShell>
    <div className="flex flex-col gap-4" role="status">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="font-medium text-red-900">Noch nicht ganz.</p>
        <p className="mt-1 text-red-800 text-sm">
          Erwartete Antwort: <span lang="en">memory</span>
        </p>
        <p className="mt-2 text-neutral-700 text-sm">
          Das bedeutet etwas anderes.
        </p>
      </div>
      <button
        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
        onClick={() => navigateToFixture('practice-empty')}
        type="button"
      >
        Weiter
      </button>
    </div>
  </PracticeShell>
);

export const PracticeEmptyFixture = () => (
  <PracticeShell>
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-6">
      <p className="font-medium">Gerade ist nichts fällig.</p>
      <button
        className="w-fit text-sm underline"
        onClick={() => navigateToFixture('dashboard')}
        type="button"
      >
        Zurück zur Übersicht
      </button>
    </div>
  </PracticeShell>
);
