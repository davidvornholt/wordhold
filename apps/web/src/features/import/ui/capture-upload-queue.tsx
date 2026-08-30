import { useId } from 'react';
import {
  processedUploadCount,
  type QueuedPage,
} from '../services/upload-queue';

type CaptureUploadQueueProps = {
  readonly busy: boolean;
  readonly pages: ReadonlyArray<QueuedPage>;
  readonly onRemove: (pageId: string) => void;
  readonly onRetry: (
    page: Extract<QueuedPage, { readonly stage: 'failed' }>,
  ) => Promise<void> | void;
};

const statusDetails = (
  page: QueuedPage,
): { readonly label: string; readonly borderClass: string } => {
  switch (page.stage) {
    case 'waiting':
      return { label: 'Wartet', borderClass: 'border-l-border' };
    case 'uploading':
      return {
        label: 'Foto wird gespeichert',
        borderClass: 'border-l-warning',
      };
    case 'extracting':
      return {
        label: 'Einträge werden gelesen',
        borderClass: 'border-l-warning',
      };
    case 'ready':
      return {
        label: 'Bereit zum Prüfen',
        borderClass: 'border-l-primary',
      };
    case 'failed':
      return {
        label:
          page.pageId === null
            ? 'Hochladen fehlgeschlagen'
            : 'Auslesen fehlgeschlagen',
        borderClass: 'border-l-destructive',
      };
    default:
      return page satisfies never;
  }
};

export const CaptureUploadQueue = ({
  busy,
  pages,
  onRemove,
  onRetry,
}: CaptureUploadQueueProps) => {
  const headingId = useId();
  if (pages.length === 0) {
    return null;
  }

  const processed = processedUploadCount(pages);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl" id={headingId}>
          Ausgewählte Seiten
        </h2>
        <output aria-live="polite" className="text-muted-foreground text-sm">
          {processed === 0
            ? `${pages.length} Fotos ausgewählt`
            : `${processed} von ${pages.length} Seiten verarbeitet`}
        </output>
      </div>
      <progress
        aria-label="Verarbeitete Seiten"
        className="h-2 w-full accent-primary"
        max={pages.length}
        value={processed}
      />
      <ol className="flex flex-col gap-3">
        {pages.map((page, index) => {
          const status = statusDetails(page);
          const removable =
            page.stage === 'waiting' ||
            (page.stage === 'failed' && page.pageId === null);
          return (
            <li
              className={`flex gap-3 border border-border border-l-4 bg-card p-3 ${status.borderClass}`}
              key={page.id}
            >
              <img
                alt=""
                className="h-20 w-16 shrink-0 border border-border object-cover"
                src={page.previewUrl}
              />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-display text-lg">Seite {index + 1}</p>
                <p className="truncate text-muted-foreground text-xs">
                  {page.file.name}
                </p>
                <p className="font-medium text-sm">{status.label}</p>
                {page.stage === 'failed' ? (
                  <p className="text-destructive text-sm" role="alert">
                    {page.error}
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-3 text-sm">
                  {page.stage === 'failed' ? (
                    <button
                      className="underline underline-offset-4 disabled:opacity-50"
                      disabled={busy}
                      onClick={() => onRetry(page)}
                      type="button"
                    >
                      Erneut versuchen
                    </button>
                  ) : null}
                  {removable ? (
                    <button
                      aria-label={`Seite ${index + 1} entfernen`}
                      className="text-muted-foreground underline underline-offset-4 disabled:opacity-50"
                      disabled={busy}
                      onClick={() => onRemove(page.id)}
                      type="button"
                    >
                      Entfernen
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
