import { useRef, useState } from 'react';
import { AudioRecovery } from '../src/features/import/ui/audio-recovery';
import { finishAudioRecovery } from '../src/features/import/ui/audio-recovery-navigation';

type Deferred = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (cause: unknown) => void;
};

const makeDeferred = (): Deferred => {
  let resolve: Deferred['resolve'] = () => undefined;
  let reject: Deferred['reject'] = () => undefined;
  const promise = new Promise<void>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
};

type RecoveryView = 'dashboard' | 'stack' | 'verification';

export const DeferredAudioRecoveryFixture = () => {
  const active = useRef<boolean>(true);
  const deferred = useRef<Deferred | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<RecoveryView>('verification');
  const retry = () => {
    const pending = makeDeferred();
    deferred.current = pending;
    setBusy(true);
    setError(null);
    finishAudioRecovery({
      finishNavigation: () => {
        setView('dashboard');
        return Promise.resolve();
      },
      refreshOverview: () => Promise.resolve(),
      retry: () => pending.promise,
      shouldNavigate: () => active.current,
    })
      .catch(() => setError('Pronunciation unavailable'))
      .finally(() => setBusy(false));
  };

  if (view === 'dashboard') {
    return (
      <main className="page-column p-6">
        <h1 className="font-display font-semibold text-2xl">Übersicht</h1>
      </main>
    );
  }

  if (view === 'stack') {
    return (
      <main className="page-column flex flex-col gap-4 p-6">
        <h1 className="font-display font-semibold text-2xl">
          Seiten im Stapel
        </h1>
        <button onClick={() => deferred.current?.resolve()} type="button">
          Resolve pronunciation
        </button>
      </main>
    );
  }

  return (
    <main className="page-column flex flex-col gap-4 p-6">
      <button
        className="text-muted-foreground text-sm underline"
        onClick={() => {
          active.current = false;
          setView('stack');
        }}
        type="button"
      >
        ← Seitenstapel
      </button>
      <h1 className="font-display font-semibold text-2xl">
        English A2: Seite überprüfen
      </h1>
      <AudioRecovery busy={busy} error={error} imported={1} onRetry={retry} />
      <fieldset>
        <legend>Test controls</legend>
        <button onClick={() => deferred.current?.resolve()} type="button">
          Resolve pronunciation
        </button>
        <button
          onClick={() => deferred.current?.reject(new Error('Test rejection'))}
          type="button"
        >
          Reject pronunciation
        </button>
      </fieldset>
    </main>
  );
};
