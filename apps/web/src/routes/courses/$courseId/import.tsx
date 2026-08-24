import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { type SubmitEvent, useState } from 'react';
import { getCourse } from '../../../shared/import/server-fns';

type UploadResponse = {
  readonly pageId?: string;
  readonly error?: string;
  readonly extractionError?: string | null;
};

const CaptureScreen = () => {
  const course = Route.useLoaderData();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set('courseId', course.id);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/pages', {
        method: 'POST',
        body: formData,
      });
      const body = (await response.json()) as UploadResponse;
      if (!response.ok || body.pageId === undefined) {
        throw new Error(body.error ?? 'Upload fehlgeschlagen.');
      }
      await navigate({
        to: '/pages/$pageId/verify',
        params: { pageId: body.pageId },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <Link className="text-neutral-500 text-sm underline" to="/">
        ← Übersicht
      </Link>
      <h1 className="font-semibold text-2xl">{course.name}: Seite erfassen</h1>
      <p className="text-neutral-600 text-sm">
        Fotografiere die Vokabelseite oder wähle ein vorhandenes Foto. Nach dem
        Hochladen liest Wordhold die Einträge aus; du prüfst sie, bevor etwas
        importiert wird.
      </p>
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <input
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="rounded border border-neutral-300 p-2 text-sm"
          disabled={busy}
          name="image"
          required={true}
          type="file"
        />
        <button
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy ? 'Wird gelesen …' : 'Hochladen und auslesen'}
        </button>
      </form>
      {error === null ? null : <p className="text-red-700 text-sm">{error}</p>}
    </main>
  );
};

export const Route = createFileRoute('/courses/$courseId/import')({
  loader: ({ params }) => getCourse({ data: params.courseId }),
  component: CaptureScreen,
});
