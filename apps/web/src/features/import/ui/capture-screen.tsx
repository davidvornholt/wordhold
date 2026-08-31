import type { ChangeEventHandler, ReactNode, SubmitEventHandler } from 'react';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import { PageLayout } from '../../../shared/ui/page-layout';
import {
  hasStoredUpload,
  maximumUploadBatchSize,
  type QueuedPage,
} from '../services/upload-queue';
import { CaptureUploadQueue } from './capture-upload-queue';

type CaptureScreenProps = {
  readonly backControl: ReactNode;
  readonly courseName: string;
  readonly busy: boolean;
  readonly batchStarted: boolean;
  readonly error: string | null;
  readonly pages: ReadonlyArray<QueuedPage>;
  readonly onFilesSelected: (files: ReadonlyArray<File>) => void;
  readonly onRemove: (pageId: string) => void;
  readonly onRetry: (
    page: Extract<QueuedPage, { readonly stage: 'failed' }>,
  ) => Promise<void> | void;
  readonly onSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly reviewAction: ReactNode;
};

const fileSelectionHandler =
  (
    onFilesSelected: CaptureScreenProps['onFilesSelected'],
  ): ChangeEventHandler<HTMLInputElement> =>
  (event) => {
    onFilesSelected(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = '';
  };

export const CaptureScreen = ({
  backControl,
  courseName,
  busy,
  batchStarted,
  error,
  pages,
  onFilesSelected,
  onRemove,
  onRetry,
  onSubmit,
  reviewAction,
}: CaptureScreenProps) => {
  const batchLocked = batchStarted || hasStoredUpload(pages);
  return (
    <PageLayout backControl={backControl} title={`${courseName}: Seiten erfassen`}>
      <p className="text-muted-foreground text-sm">
        Fotografiere eine Vokabelseite oder wähle bis zu zehn vorhandene Fotos.
        Wordhold speichert und liest jede Seite einzeln. Danach prüfst du die
        erkannten Einträge.
      </p>
      <form
        aria-busy={busy}
        className="flex flex-col gap-4"
        onSubmit={onSubmit}
      >
        <fieldset
          className="grid gap-3 sm:grid-cols-2"
          disabled={
            busy || pages.length >= maximumUploadBatchSize || batchLocked
          }
        >
          <legend className="sr-only">Fotos hinzufügen</legend>
          <label className="flex flex-col gap-2 border border-input bg-card p-4 text-sm">
            <span className="font-display text-lg">Fotos auswählen</span>
            <span className="text-muted-foreground">
              Mehrere JPEG-, PNG- oder WebP-Dateien
            </span>
            <input
              accept="image/jpeg,image/png,image/webp"
              className="peer sr-only"
              multiple={true}
              onChange={fileSelectionHandler(onFilesSelected)}
              type="file"
            />
            <span className="mt-auto inline-flex min-h-11 items-center justify-center border border-input bg-background px-4 py-2 text-center peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-2 peer-disabled:opacity-50">
              Dateien auswählen
            </span>
          </label>
          <label className="flex flex-col gap-2 border border-input bg-card p-4 text-sm">
            <span className="font-display text-lg">Foto aufnehmen</span>
            <span className="text-muted-foreground">
              Öffnet die rückseitige Kamera für eine Seite
            </span>
            <input
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="peer sr-only"
              onChange={fileSelectionHandler(onFilesSelected)}
              type="file"
            />
            <span className="mt-auto inline-flex min-h-11 items-center justify-center border border-input bg-background px-4 py-2 text-center peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-2 peer-disabled:opacity-50">
              Kamera öffnen
            </span>
          </label>
        </fieldset>
        {batchLocked ? (
          <p className="text-muted-foreground text-sm" role="status">
            Die Fotoauswahl ist gesperrt. Versuche fehlgeschlagene Seiten
            erneut.
          </p>
        ) : null}
        <CaptureUploadQueue
          busy={busy}
          onRemove={onRemove}
          onRetry={onRetry}
          pages={pages}
        />
        {reviewAction}
        {pages.some((page) => page.stage === 'waiting') ? (
          <Button disabled={busy} type="submit">
            {busy
              ? 'Seiten werden verarbeitet …'
              : `${countNoun(
                  pages.filter((page) => page.stage === 'waiting').length,
                  'Seite',
                  'Seiten',
                )} hochladen und auslesen`}
          </Button>
        ) : null}
      </form>
      {error === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </PageLayout>
  );
};
