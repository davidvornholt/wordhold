import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
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

const useAudioRecoveryPass = ({
  pages,
  onRecovered,
  onRetry,
}: AudioRecoveryPagesProps) => {
  const attemptedPageIdsRef = useRef(new Set<string>());
  const currentPassRef = useRef(-1);
  const pendingAttemptsRef = useRef(0);
  const recoveryQueueRef = useRef(Promise.resolve());
  const [creating, setCreating] = useState(pages.length > 0);
  const [pass, setPass] = useState(0);
  const pageIds = pages.map((page) => page.id).join('\n');
  const recover = useEffectEvent(onRecovered);
  const retry = useEffectEvent(onRetry);

  const attemptPage = useEffectEvent(async (pageId: string) => {
    const page = pages.find((candidate) => candidate.id === pageId);
    try {
      if (page !== undefined) {
        const result = await retry(page);
        if (result.pending === 0) {
          await recover();
        }
      }
    } catch {
      // Continue the pass so one failed page cannot block later pages.
    } finally {
      pendingAttemptsRef.current -= 1;
    }
  });

  const enqueueRecovery = useEffectEvent(
    (loadedPageIds: string, requestedPass: number) => {
      if (currentPassRef.current !== requestedPass) {
        currentPassRef.current = requestedPass;
        attemptedPageIdsRef.current.clear();
      }
      const nextPageIds = loadedPageIds
        .split('\n')
        .filter(
          (pageId) =>
            pageId.length > 0 && !attemptedPageIdsRef.current.has(pageId),
        );
      if (nextPageIds.length === 0) {
        return;
      }
      for (const pageId of nextPageIds) {
        attemptedPageIdsRef.current.add(pageId);
      }
      pendingAttemptsRef.current += nextPageIds.length;
      setCreating(true);
      const queuedRecovery = nextPageIds.reduce(
        (queue, pageId) => queue.then(() => attemptPage(pageId)),
        recoveryQueueRef.current,
      );
      recoveryQueueRef.current = queuedRecovery.then(() => {
        if (pendingAttemptsRef.current === 0) {
          setCreating(false);
        }
      });
    },
  );

  useEffect(() => {
    enqueueRecovery(pageIds, pass);
  }, [pageIds, pass]);

  return {
    creating,
    retryAll: () => setPass((current) => current + 1),
  };
};

export const AudioRecoveryPages = (props: AudioRecoveryPagesProps) => {
  const { pages } = props;
  const { creating, retryAll } = useAudioRecoveryPass(props);

  if (pages.length === 0) {
    return null;
  }

  const missing = pages.reduce(
    (total, candidate) => total + candidate.missingAudio,
    0,
  );

  return (
    <section aria-live="polite">
      <Callout aria-busy={creating} tone={creating ? 'neutral' : 'warning'}>
        <h2 className="font-display text-xl">
          {creating
            ? 'Aussprache wird erstellt'
            : 'Aussprache noch nicht vollständig'}
        </h2>
        <p className="text-sm">
          {creating
            ? `Wordhold erstellt gerade die Aussprache für ${countNoun(
                missing,
                'Vokabel',
                'Vokabeln',
              )}. Du kannst die Kurse bereits nutzen.`
            : `Für ${countNoun(
                missing,
                'Vokabel',
                'Vokabeln',
              )} fehlt noch die Aussprache. Du kannst es jetzt erneut versuchen.`}
        </p>
        {creating ? null : (
          <div>
            <Button onClick={retryAll}>Aussprache erneut erstellen</Button>
          </div>
        )}
      </Callout>
    </section>
  );
};
