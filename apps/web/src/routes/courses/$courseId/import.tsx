import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { type SubmitEvent, useState } from 'react';
import { getCourse } from '../../../features/import/server-fns';
import { CaptureScreen as CaptureScreenView } from '../../../features/import/ui/capture-screen';

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
    <CaptureScreenView
      backControl={
        <Link className="text-neutral-500 text-sm underline" to="/">
          ← Übersicht
        </Link>
      }
      busy={busy}
      courseName={course.name}
      error={error}
      onSubmit={onSubmit}
    />
  );
};

export const Route = createFileRoute('/courses/$courseId/import')({
  loader: ({ params }) => getCourse({ data: params.courseId }),
  component: CaptureScreen,
});
