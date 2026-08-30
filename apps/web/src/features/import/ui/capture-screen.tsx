import type { ChangeEventHandler, ReactNode, SubmitEventHandler } from 'react';
import {
  maximumUploadBatchSize,
  type QueuedPage,
} from '../services/upload-queue';
import { CaptureUploadQueue } from './capture-upload-queue';

type CaptureScreenProps = {
  readonly backControl: ReactNode;
  readonly courseName: string;
  readonly busy: boolean;
  readonly error: string | null;
  readonly pages: ReadonlyArray<QueuedPage>;
  readonly onFilesSelected: (files: ReadonlyArray<File>) => void;
  readonly onRemove: (pageId: string) => void;
  readonly onRetry: (
    page: Extract<QueuedPage, { readonly stage: 'failed' }>,
  ) => Promise<void> | void;
  readonly onSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly reviewAction: ReactNode;
  readonly renderVerifyAction: (
    page: Extract<QueuedPage, { readonly stage: 'ready' }>,
  ) => ReactNode;
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
  error,
  pages,
  onFilesSelected,
  onRemove,
  onRetry,
  onSubmit,
  reviewAction,
  renderVerifyAction,
}: CaptureScreenProps) => (
  <main className="page-column flex flex-col gap-4 p-6">
    {backControl}
    <h1 className="font-display font-semibold text-2xl">
      {courseName}: Seiten erfassen
    </h1>
    <p className="text-muted-foreground text-sm">
      Fotografiere eine Vokabelseite oder wähle bis zu zehn vorhandene Fotos.
      Wordhold speichert und liest jede Seite einzeln. Danach prüfst du die
      erkannten Einträge.
    </p>
    <form aria-busy={busy} className="flex flex-col gap-4" onSubmit={onSubmit}>
      <fieldset
        className="grid gap-3 sm:grid-cols-2"
        disabled={busy || pages.length >= maximumUploadBatchSize}
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
          <span className="mt-auto border border-input bg-background px-4 py-2 text-center peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-2 peer-disabled:opacity-50">
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
          <span className="mt-auto border border-input bg-background px-4 py-2 text-center peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-2 peer-disabled:opacity-50">
            Kamera öffnen
          </span>
        </label>
      </fieldset>
      <CaptureUploadQueue
        busy={busy}
        onRemove={onRemove}
        onRetry={onRetry}
        pages={pages}
        renderVerifyAction={renderVerifyAction}
      />
      {reviewAction}
      {pages.some((page) => page.stage === 'waiting') ? (
        <button
          className="bg-primary px-4 py-2 text-primary-foreground text-sm disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy
            ? 'Seiten werden verarbeitet …'
            : `${pages.filter((page) => page.stage === 'waiting').length} ${
                pages.filter((page) => page.stage === 'waiting').length === 1
                  ? 'Seite'
                  : 'Seiten'
              } hochladen und auslesen`}
        </button>
      ) : null}
    </form>
    {error === null ? null : (
      <p className="text-destructive text-sm" role="alert">
        {error}
      </p>
    )}
  </main>
);
