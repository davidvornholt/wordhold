import { useState } from 'react';
import type { QueuedPage } from '../src/features/import/services/upload-queue';
import { CaptureScreen } from '../src/features/import/ui/capture-screen';
import { navigateToFixture } from './fixture-state';
import { photographedPage } from './verification-fixture-data';

type ImportFixtureState =
  | 'empty'
  | 'selected'
  | 'progress'
  | 'complete'
  | 'failed';

const fixtureFile = (index: number) =>
  new File(['fixture'], `vokabelseite-${index}.png`, { type: 'image/png' });

const fixtureStages = (
  state: ImportFixtureState,
): ReadonlyArray<QueuedPage['stage']> => {
  if (state === 'selected') {
    return ['waiting', 'waiting', 'waiting'];
  }
  if (state === 'progress') {
    return ['ready', 'extracting', 'waiting'];
  }
  if (state === 'failed') {
    return ['ready', 'failed', 'ready'];
  }
  return state === 'complete' ? ['ready', 'ready', 'ready'] : [];
};

const fixtureQueue = (state: ImportFixtureState): ReadonlyArray<QueuedPage> =>
  fixtureStages(state).map((stage, index): QueuedPage => {
    const base = {
      id: `fixture-page-${index + 1}`,
      file: fixtureFile(index + 1),
      position: index,
      previewUrl: photographedPage,
    };
    if (stage === 'extracting') {
      return { ...base, stage, pageId: `stored-page-${index + 1}` };
    }
    if (stage === 'ready') {
      return { ...base, stage, pageId: `ready-page-${index + 1}` };
    }
    if (stage === 'failed') {
      return {
        ...base,
        stage,
        pageId: null,
        error: 'Das Foto konnte nicht gespeichert werden.',
      };
    }
    return { ...base, stage };
  });

type ImportFixtureProps = {
  readonly error?: boolean;
  readonly initialState?: ImportFixtureState;
};

export const ImportFixture = ({
  error = false,
  initialState = 'empty',
}: ImportFixtureProps) => {
  const [pages, setPages] = useState(fixtureQueue(initialState));
  const busy = initialState === 'progress';
  return (
    <CaptureScreen
      backControl={
        <button
          className="text-muted-foreground text-sm underline"
          onClick={() => navigateToFixture('dashboard')}
          type="button"
        >
          ← Übersicht
        </button>
      }
      busy={busy}
      courseName="English A2"
      error={
        error
          ? 'Das Foto konnte nicht gelesen werden. Wähle eine andere Datei.'
          : null
      }
      onFilesSelected={(files) => {
        setPages(
          files.map((file, index) => ({
            id: `selected-page-${index + 1}`,
            file,
            position: index,
            previewUrl: photographedPage,
            stage: 'waiting',
          })),
        );
      }}
      onRemove={(pageId) =>
        setPages((current) => current.filter((page) => page.id !== pageId))
      }
      onRetry={(failed) =>
        setPages((current) =>
          current.map((page) =>
            page.id === failed.id
              ? {
                  id: page.id,
                  file: page.file,
                  position: page.position,
                  previewUrl: page.previewUrl,
                  stage: 'ready',
                  pageId: failed.pageId ?? 'retried-page',
                }
              : page,
          ),
        )
      }
      onSubmit={(event) => {
        event.preventDefault();
        setPages((current) =>
          current.map((page, index) => ({
            id: page.id,
            file: page.file,
            position: page.position,
            previewUrl: page.previewUrl,
            stage: 'ready',
            pageId: `ready-page-${index + 1}`,
          })),
        );
      }}
      pages={pages}
      reviewAction={
        pages.length > 0 && pages.every((page) => page.stage === 'ready') ? (
          <button
            className="bg-primary px-4 py-2 text-primary-foreground text-sm"
            onClick={() => navigateToFixture('import-session')}
            type="button"
          >
            Stapel prüfen
          </button>
        ) : null
      }
    />
  );
};
