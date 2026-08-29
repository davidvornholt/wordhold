import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import type { ExtractionResult } from '@wordhold/ai/extraction';
import { useState } from 'react';
import { importPage } from '../../../features/import/import-fn';
import type { UnitSelectionData } from '../../../features/import/schemas/import-payload';
import {
  getPage,
  retryAudio,
  retryExtraction,
} from '../../../features/import/server-fns';
import { AudioRecovery } from '../../../features/import/ui/audio-recovery';
import type { DraftEntry } from '../../../features/import/ui/entry-row';
import { ExtractionRecovery } from '../../../features/import/ui/extraction-recovery';
import { VerificationImage } from '../../../features/import/ui/verification-image';
import { VerifyForm } from '../../../features/import/ui/verify-form';
import { germanLabels } from '../../../shared/languages';

const draftsFromExtraction = (
  extraction: ExtractionResult | null,
): ReadonlyArray<DraftEntry> =>
  extraction === null
    ? []
    : extraction.page.entries.map((entry) => ({
        targetText: entry.targetText,
        nativeText: entry.nativeText,
        example: entry.example ?? '',
        ...(entry.grammar === undefined ? {} : { grammar: entry.grammar }),
        confidence: entry.confidence,
      }));

const toPayloadEntry = (
  draft: DraftEntry & { readonly unit: UnitSelectionData },
) => ({
  unit: draft.unit,
  targetText: draft.targetText,
  nativeText: draft.nativeText,
  ...(draft.grammar === undefined ? {} : { grammar: draft.grammar }),
  ...(draft.example.trim() === '' ? {} : { example: draft.example.trim() }),
});

const VerifyScreen = () => {
  const { page, course, units } = Route.useLoaderData();
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
    <main className="verification-screen">
      <div className="verification-header">
        <Link className="text-muted-foreground text-sm underline" to="/">
          ← Übersicht
        </Link>
        <h1 className="font-display font-semibold text-2xl">
          {course.name}: Seite überprüfen
        </h1>
        {error === null ? null : (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="verification-workbench">
        <div className="verification-image-pane">
          <VerificationImage src={`/api/pages/${page.id}/image`} />
        </div>
        <div className="verification-form-pane">
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
            <ExtractionRecovery
              busy={busy}
              onRetry={() =>
                run(async () => {
                  const updated = await retryExtraction({ data: page.id });
                  setExtraction(updated.extraction);
                })
              }
            />
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
              units={units}
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
