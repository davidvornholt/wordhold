import { useRef, useState } from 'react';
import { AudioRecovery } from '../src/features/import/ui/audio-recovery';
import { CaptureScreen } from '../src/features/import/ui/capture-screen';
import type { DraftEntry } from '../src/features/import/ui/entry-row';
import { ExtractionRecovery } from '../src/features/import/ui/extraction-recovery';
import { VerificationImage } from '../src/features/import/ui/verification-image';
import { VerifyForm } from '../src/features/import/ui/verify-form';
import { completeAudioRecovery, navigateToFixture } from './fixture-state';

const backControl = (
  <button
    className="text-neutral-500 text-sm underline"
    onClick={() => navigateToFixture('dashboard')}
    type="button"
  >
    ← Übersicht
  </button>
);

const initialEntries: ReadonlyArray<DraftEntry> = [
  {
    type: 'word',
    targetText: 'memory',
    nativeText: 'Erinnerung',
    example: 'A lasting memory.',
  },
];

const photographedPage = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><title>Fixture page</title></svg>',
)}`;

export const ImportFixture = ({ error = false }) => (
  <CaptureScreen
    backControl={backControl}
    busy={false}
    courseName="English A2"
    error={
      error
        ? 'Das Foto konnte nicht gelesen werden. Wähle eine andere Datei.'
        : null
    }
    onSubmit={(event) => {
      event.preventDefault();
      navigateToFixture('verification');
    }}
  />
);

type VerificationFixtureProps = {
  readonly empty?: boolean;
  readonly audioRecovery?: boolean;
};

export const VerificationFixture = ({
  empty = false,
  audioRecovery = false,
}: VerificationFixtureProps) => (
  <main className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
    {audioRecovery ? (
      <button
        className="text-neutral-500 text-sm underline"
        onClick={() => navigateToFixture('dashboard-audio-recovery')}
        type="button"
      >
        ← Übersicht
      </button>
    ) : (
      backControl
    )}
    <h1 className="font-semibold text-2xl">English A2: Seite überprüfen</h1>
    <div className="grid gap-6 lg:grid-cols-2">
      <VerificationImage src={photographedPage} />
      <div>
        {audioRecovery ? (
          <AudioRecovery
            busy={false}
            imported={1}
            onRetry={() => {
              completeAudioRecovery();
              navigateToFixture('dashboard-audio-recovery');
            }}
            pending={1}
          />
        ) : null}
        {!audioRecovery && empty ? (
          <ExtractionRecovery
            busy={false}
            onRetry={() => navigateToFixture('verification')}
          />
        ) : null}
        {audioRecovery || empty ? null : (
          <VerifyForm
            busy={false}
            initialEntries={initialEntries}
            initialLabel="Unit 3"
            onSubmit={() => navigateToFixture('dashboard')}
            targetLabel="Englisch"
          />
        )}
      </div>
    </div>
  </main>
);

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

export const DeferredVerificationFixture = () => {
  const deferred = useRef<Deferred | null>(null);
  const [busy, setBusy] = useState(false);
  const [calls, setCalls] = useState(0);
  const [snapshot, setSnapshot] = useState('none');
  const [status, setStatus] = useState('idle');
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl">Seite überprüfen</h1>
      <VerifyForm
        busy={busy}
        initialEntries={initialEntries}
        initialLabel="Unit 3"
        onSubmit={(label, entries) => {
          const pending = makeDeferred();
          deferred.current = pending;
          setBusy(true);
          setCalls((count) => count + 1);
          setSnapshot(JSON.stringify({ label, entries }));
          setStatus('pending');
          pending.promise
            .then(() => setStatus('resolved'))
            .catch(() => setStatus('rejected'))
            .finally(() => setBusy(false));
        }}
        targetLabel="Englisch"
      />
      <output aria-label="Verification calls">{calls}</output>
      <output aria-label="Verification snapshot">{snapshot}</output>
      <output aria-label="Verification status">{status}</output>
      <fieldset>
        <legend>Test controls</legend>
        <button onClick={() => deferred.current?.resolve()} type="button">
          Resolve verification
        </button>
        <button
          onClick={() => deferred.current?.reject(new Error('Test rejection'))}
          type="button"
        >
          Reject verification
        </button>
      </fieldset>
    </main>
  );
};
