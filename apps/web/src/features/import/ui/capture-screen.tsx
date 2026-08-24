import type { ReactNode, SubmitEventHandler } from 'react';

type CaptureScreenProps = {
  readonly backControl: ReactNode;
  readonly courseName: string;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onSubmit: SubmitEventHandler<HTMLFormElement>;
};

export const CaptureScreen = ({
  backControl,
  courseName,
  busy,
  error,
  onSubmit,
}: CaptureScreenProps) => (
  <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
    {backControl}
    <h1 className="font-semibold text-2xl">{courseName}: Seite erfassen</h1>
    <p className="text-neutral-600 text-sm">
      Fotografiere die Vokabelseite oder wähle ein vorhandenes Foto. Nach dem
      Hochladen liest Wordhold die Einträge aus; du prüfst sie, bevor etwas
      importiert wird.
    </p>
    <form aria-busy={busy} className="flex flex-col gap-4" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 text-sm">
        Foto der Vokabelseite
        <input
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
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
    {error === null ? null : (
      <p className="text-red-700 text-sm" role="alert">
        {error}
      </p>
    )}
  </main>
);
