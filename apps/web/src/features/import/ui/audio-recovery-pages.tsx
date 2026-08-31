import { useEffect, useEffectEvent, useState } from 'react';
import { countNoun } from '../../../shared/format/count';
import { Callout } from '../../../shared/ui/callout';

type AudioRecoveryPage = {
  readonly id: string;
  readonly missingAudio: number;
};

type AudioRecoveryPagesProps = {
  readonly pages: ReadonlyArray<AudioRecoveryPage>;
  readonly onRecovered: () => Promise<void>;
  readonly onRetry: (
    page: AudioRecoveryPage,
  ) => Promise<{ readonly pending: number }>;
};

type RecoveryStatus = 'creating' | 'waiting';

export const AudioRecoveryPages = ({
  pages,
  onRecovered,
  onRetry,
}: AudioRecoveryPagesProps) => {
  const [status, setStatus] = useState<RecoveryStatus>('creating');
  const page = pages.at(0);
  const recover = useEffectEvent(onRecovered);
  const retry = useEffectEvent(onRetry);

  useEffect(() => {
    if (page === undefined) {
      return;
    }
    let active = true;
    retry(page)
      .then(async (result) => {
        if (!active) {
          return;
        }
        if (result.pending === 0) {
          await recover();
          return;
        }
        setStatus('waiting');
      })
      .catch(() => {
        if (active) {
          setStatus('waiting');
        }
      });
    return () => {
      active = false;
    };
  }, [page]);

  if (pages.length === 0) {
    return null;
  }

  const missing = pages.reduce(
    (total, candidate) => total + candidate.missingAudio,
    0,
  );

  return (
    <section aria-live="polite">
      <Callout
        aria-busy={status === 'creating'}
        tone={status === 'creating' ? 'neutral' : 'warning'}
      >
        <h2 className="font-display text-xl">
          {status === 'creating'
            ? 'Aussprache wird erstellt'
            : 'Aussprache folgt automatisch'}
        </h2>
        <p className="text-sm">
          {status === 'creating'
            ? `Wordhold erstellt gerade die Aussprache für ${countNoun(
                missing,
                'Vokabel',
                'Vokabeln',
              )}. Du kannst die Kurse bereits nutzen.`
            : 'Die Aussprache ist gerade nicht verfügbar. Wordhold versucht es bei deinem nächsten Besuch erneut.'}
        </p>
      </Callout>
    </section>
  );
};
