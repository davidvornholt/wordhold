import { useRef, useState } from 'react';
import { AudioRecoveryPages } from '../src/features/import/ui/audio-recovery-pages';

const recoveryPages = [
  { id: 'recovery-page-1', missingAudio: 1 },
  { id: 'recovery-page-2', missingAudio: 1 },
  { id: 'recovery-page-3', missingAudio: 1 },
] as const;

export const AudioRecoveryPagesFixture = () => {
  const [pages, setPages] =
    useState<ReadonlyArray<(typeof recoveryPages)[number]>>(recoveryPages);
  const [attempts, setAttempts] = useState(0);
  const [maximumConcurrentAttempts, setMaximumConcurrentAttempts] = useState(0);
  const activeAttempts = useRef(0);
  const firstPageFailed = useRef(false);

  return (
    <div className="flex flex-col gap-4">
      <AudioRecoveryPages
        onRecovered={() => Promise.resolve()}
        onRetry={(page) => {
          setAttempts((current) => current + 1);
          activeAttempts.current += 1;
          setMaximumConcurrentAttempts((current) =>
            Math.max(current, activeAttempts.current),
          );
          return new Promise((resolve) => {
            globalThis.setTimeout(() => {
              const firstFailure =
                page.id === recoveryPages[0].id && !firstPageFailed.current;
              firstPageFailed.current ||= firstFailure;
              if (!firstFailure) {
                setPages((current) =>
                  current.filter((candidate) => candidate.id !== page.id),
                );
              }
              activeAttempts.current -= 1;
              resolve({ pending: firstFailure ? 1 : 0 });
            });
          });
        }}
        pages={pages}
      />
      <output aria-label="Erstellungsversuche">{attempts}</output>
      <output aria-label="Gleichzeitige Erstellungsversuche">
        {maximumConcurrentAttempts}
      </output>
      <div>
        <button
          onClick={() =>
            setPages((current) => current.map((page) => ({ ...page })))
          }
          type="button"
        >
          Daten neu laden
        </button>
      </div>
    </div>
  );
};
