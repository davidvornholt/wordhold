import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import type { ExtractionResult } from '@wordhold/ai/extraction';
import { useState } from 'react';
import { importPage } from '../../../features/import/import-fn';
import {
  getPage,
  retryAudio,
  retryExtraction,
} from '../../../features/import/server-fns';
import { AudioRecovery } from '../../../features/import/ui/audio-recovery';
import type { DraftEntry } from '../../../features/import/ui/entry-row';
import { VerifyForm } from '../../../features/import/ui/verify-form';
import { germanLabels } from '../../../shared/languages';

const draftsFromExtraction = (
  extraction: ExtractionResult | null,
): ReadonlyArray<DraftEntry> =>
  extraction === null
    ? []
    : extraction.page.entries.map((entry) => ({
        type: entry.type,
        targetText: entry.targetText,
        nativeText: entry.nativeText,
        example: entry.example ?? '',
        ...(entry.grammar === undefined ? {} : { grammar: entry.grammar }),
        confidence: entry.confidence,
      }));

const toPayloadEntry = (draft: DraftEntry) => ({
  type: draft.type,
  targetText: draft.targetText,
  nativeText: draft.nativeText,
  ...(draft.grammar === undefined ? {} : { grammar: draft.grammar }),
  ...(draft.example.trim() === '' ? {} : { example: draft.example.trim() }),
});

const VerifyScreen = () => {
  const { page, course } = Route.useLoaderData();
  const navigate = useNavigate();
  const [extraction, setExtraction] = useState(page.extraction);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{
    readonly imported: number | null;
    readonly pending: number | null;
  } | null>(
    page.status === 'verified' ? { imported: null, pending: null } : null,
  );

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const targetLabel = germanLabels[course.targetLanguage];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <Link className="text-neutral-500 text-sm underline" to="/">
        ← Übersicht
      </Link>
      <h1 className="font-semibold text-2xl">
        {course.name}: Seite überprüfen
      </h1>
      {error === null ? null : <p className="text-red-700 text-sm">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <img
          alt="Fotografierte Vokabelseite"
          className="h-auto w-full self-start rounded-lg border border-neutral-200"
          src={`/api/pages/${page.id}/image`}
        />
        <div>
          {completed === null ? null : (
            <AudioRecovery
              busy={busy}
              imported={completed.imported}
              onRetry={() =>
                run(async () => {
                  const result = await retryAudio({ data: page.id });
                  if (result.pending === 0) {
                    await navigate({ to: '/' });
                    return;
                  }
                  setCompleted((current) =>
                    current === null
                      ? null
                      : { ...current, pending: result.pending },
                  );
                })
              }
              pending={completed.pending}
            />
          )}
          {completed === null && extraction === null ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-neutral-600 text-sm">
                Die Seite wurde noch nicht ausgelesen oder das Auslesen ist
                fehlgeschlagen.
              </p>
              <button
                className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const updated = await retryExtraction({ data: page.id });
                    setExtraction(updated.extraction);
                  })
                }
                type="button"
              >
                {busy ? 'Wird gelesen …' : 'Erneut auslesen'}
              </button>
            </div>
          ) : null}
          {completed === null && extraction !== null ? (
            <VerifyForm
              busy={busy}
              initialEntries={draftsFromExtraction(extraction)}
              initialLabel={page.label ?? extraction.page.pageLabel ?? ''}
              key={extraction.modelId + String(extraction.page.entries.length)}
              onSubmit={(label, verified) =>
                run(async () => {
                  const result = await importPage({
                    data: {
                      pageId: page.id,
                      ...(label.trim() === '' ? {} : { label: label.trim() }),
                      entries: verified.map(toPayloadEntry),
                    },
                  });
                  if (result.audio.pending === 0) {
                    await navigate({ to: '/' });
                    return;
                  }
                  setCompleted({
                    imported: result.imported,
                    pending: result.audio.pending,
                  });
                })
              }
              targetLabel={targetLabel}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
};

export const Route = createFileRoute('/pages/$pageId/verify')({
  loader: ({ params }) => getPage({ data: params.pageId }),
  component: VerifyScreen,
});
