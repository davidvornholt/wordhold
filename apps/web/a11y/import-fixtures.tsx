import { type SubmitEvent, useState } from 'react';
import { AudioRecovery } from '../src/features/import/ui/audio-recovery';
import { navigateToFixture } from './fixture-state';

const BackButton = () => (
  <button
    className="text-neutral-500 text-sm underline"
    onClick={() => navigateToFixture('dashboard')}
    type="button"
  >
    ← Übersicht
  </button>
);

export const ImportFixture = ({ error = false }) => {
  const [busy, setBusy] = useState(false);
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    navigateToFixture('verification');
  };
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <BackButton />
      <h1 className="font-semibold text-2xl">English A2: Seite erfassen</h1>
      <p className="text-neutral-600 text-sm">
        Fotografiere die Vokabelseite oder wähle ein vorhandenes Foto. Nach dem
        Hochladen liest Wordhold die Einträge aus; du prüfst sie, bevor etwas
        importiert wird.
      </p>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <label className="flex flex-col gap-1 text-sm">
          Foto der Vokabelseite
          <input
            accept="image/jpeg,image/png,image/webp"
            className="rounded border border-neutral-300 p-2 text-sm"
            disabled={busy}
            name="image"
            required={true}
            type="file"
          />
        </label>
        <button
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy ? 'Wird gelesen …' : 'Hochladen und auslesen'}
        </button>
      </form>
      {error ? (
        <p className="text-red-700 text-sm" role="alert">
          Das Foto konnte nicht gelesen werden. Wähle eine andere Datei.
        </p>
      ) : null}
    </main>
  );
};

export const VerificationFixture = ({
  empty = false,
  audioRecovery = false,
}) => (
  <main className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
    <BackButton />
    <h1 className="font-semibold text-2xl">English A2: Seite überprüfen</h1>
    <div className="grid gap-6 lg:grid-cols-2">
      <svg
        aria-label="Fotografierte Vokabelseite"
        className="h-auto w-full self-start rounded-lg border border-neutral-200"
        role="img"
        viewBox="0 0 400 520"
      >
        <rect fill="white" height="520" width="400" />
        <path d="M40 80h320M40 140h320M40 200h320" stroke="currentColor" />
      </svg>
      <div>
        {audioRecovery ? (
          <AudioRecovery
            busy={false}
            imported={1}
            onRetry={() => navigateToFixture('dashboard')}
            pending={1}
          />
        ) : null}
        {!audioRecovery && empty ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-neutral-600 text-sm">
              Die Seite wurde noch nicht ausgelesen oder das Auslesen ist
              fehlgeschlagen.
            </p>
            <button
              className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
              type="button"
            >
              Erneut auslesen
            </button>
          </div>
        ) : null}
        {audioRecovery || empty ? null : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              navigateToFixture('dashboard');
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              Abschnitt
              <input
                className="rounded border border-neutral-300 px-3 py-2"
                defaultValue="Unit 3"
                name="label"
              />
            </label>
            <fieldset className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
              <legend className="px-1 font-medium">Eintrag 1</legend>
              <label className="flex flex-col gap-1 text-sm">
                Englisch
                <input
                  className="rounded border border-neutral-300 px-3 py-2"
                  defaultValue="memory"
                  name="target-0"
                  required={true}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Deutsch
                <input
                  className="rounded border border-neutral-300 px-3 py-2"
                  defaultValue="Erinnerung"
                  name="native-0"
                  required={true}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Beispielsatz
                <input
                  className="rounded border border-neutral-300 px-3 py-2"
                  defaultValue="A lasting memory."
                  name="example-0"
                />
              </label>
            </fieldset>
            <button
              className="rounded bg-neutral-900 px-4 py-2 text-sm text-white"
              type="submit"
            >
              1 Einträge importieren
            </button>
          </form>
        )}
      </div>
    </div>
  </main>
);
