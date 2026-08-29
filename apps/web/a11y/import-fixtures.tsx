import { useRef, useState } from 'react';
import { AudioRecovery } from '../src/features/import/ui/audio-recovery';
import { CaptureScreen } from '../src/features/import/ui/capture-screen';
import type { DraftEntry } from '../src/features/import/ui/entry-row';
import { ExtractionRecovery } from '../src/features/import/ui/extraction-recovery';
import { VerificationImage } from '../src/features/import/ui/verification-image';
import { VerifyForm } from '../src/features/import/ui/verify-form';
import { completeAudioRecovery, navigateToFixture } from './fixture-state';
import {
  photographedPage,
  verificationEntries,
} from './verification-fixture-data';

const backControl = (
  <button
    className="text-muted-foreground text-sm underline"
    onClick={() => navigateToFixture('dashboard')}
    type="button"
  >
    ← Übersicht
  </button>
);

const deferredEntries: ReadonlyArray<DraftEntry> = [
  {
    targetText: 'memory',
    nativeText: 'Erinnerung',
    example: 'A lasting memory.',
  },
];

const units = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Unit 2',
    position: 0,
    isHolding: false,
    entryCount: 18,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Unit 3',
    position: 1,
    isHolding: false,
    entryCount: 12,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Ohne Einheit',
    position: 2,
    isHolding: true,
    entryCount: 2,
  },
];

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
  readonly noUnits?: boolean;
};

export const VerificationFixture = ({
  empty = false,
  audioRecovery = false,
  noUnits = false,
}: VerificationFixtureProps) => (
  <main className="verification-screen">
    <div className="verification-header">
      {audioRecovery ? (
        <button
          className="text-muted-foreground text-sm underline"
          onClick={() => navigateToFixture('dashboard-audio-recovery')}
          type="button"
        >
          ← Übersicht
        </button>
      ) : (
        backControl
      )}
      <h1 className="font-display font-semibold text-2xl">
        English A2: Seite überprüfen
      </h1>
    </div>
    <div className="verification-workbench">
      <div className="verification-image-pane">
        <VerificationImage src={photographedPage} />
      </div>
      <div className="verification-form-pane">
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
            initialEntries={verificationEntries}
            initialLabel="Unit 3"
            onSubmit={() => navigateToFixture('dashboard')}
            targetLabel="Englisch"
            units={noUnits ? [] : units}
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
    <main className="page-column flex flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl">Seite überprüfen</h1>
      <VerifyForm
        busy={busy}
        initialEntries={deferredEntries}
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
        units={units}
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
