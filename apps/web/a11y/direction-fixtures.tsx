import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { useRef, useState } from 'react';
import { DirectionSettings } from '../src/features/courses/ui/direction-settings';
import { sessionOptions } from '../src/features/practice/services/session-options';
import { SessionStart } from '../src/features/practice/ui/session-start';
import { countNoun } from '../src/shared/format/count';
import { Button } from '../src/shared/ui/button';
import { PageLayout } from '../src/shared/ui/page-layout';
import { fixtureBackControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';

const backControl = fixtureBackControl('Übersicht', 'dashboard');
const completePracticeCounts = [
  { direction: 'to_target' as const, ready: 12 },
  { direction: 'to_native' as const, ready: 8 },
  { direction: 'both' as const, ready: 20 },
];
const partialPracticeCounts = [
  { direction: 'to_target' as const, ready: 7 },
  { direction: 'to_native' as const, ready: 0 },
  { direction: 'both' as const, ready: 7 },
];

type PracticeStartFixtureProps = {
  readonly partial?: boolean;
};

export const PracticeStartFixture = ({
  partial = false,
}: PracticeStartFixtureProps) => (
  <PageLayout backControl={backControl} title="English A2: Üben">
    <SessionStart
      itemNoun={{ singular: 'Karte', plural: 'Karten' }}
      options={sessionOptions(
        ['to_target', 'to_native'],
        'Englisch',
        partial ? partialPracticeCounts : completePracticeCounts,
      )}
      preferenceKey="english-a2:practice"
      renderStartAction={(option, rememberDirection) => (
        <Button
          className="w-fit"
          onClick={() => {
            rememberDirection();
            navigateToFixture('practice-session');
          }}
        >
          {countNoun(option.cards, 'Karte', 'Karten')} starten
        </Button>
      )}
    />
  </PageLayout>
);

// Saving is instant here, so the status line reaches "Gespeichert." the way it
// does against the server.
export const CourseSettingsFixture = () => (
  <PageLayout backControl={backControl} title="English A2: Einstellungen">
    <DirectionSettings
      initial={['to_target', 'to_native']}
      save={() => Promise.resolve()}
      targetLabel="Englisch"
    />
  </PageLayout>
);

type DeferredSave = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (cause: unknown) => void;
};

const makeDeferredSave = (): DeferredSave => {
  let resolve: DeferredSave['resolve'] = () => undefined;
  let reject: DeferredSave['reject'] = () => undefined;
  const promise = new Promise<void>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
};

export const DeferredCourseSettingsFixture = () => {
  const deferred = useRef<DeferredSave | null>(null);
  const [calls, setCalls] = useState(0);
  const [snapshot, setSnapshot] = useState('none');
  const save = (directions: ReadonlyArray<AnswerDirection>) => {
    const pending = makeDeferredSave();
    deferred.current = pending;
    setCalls((count) => count + 1);
    setSnapshot(directions.join(','));
    return pending.promise;
  };
  return (
    <PageLayout backControl={backControl} title="English A2: Einstellungen">
      <DirectionSettings
        initial={['to_target', 'to_native']}
        save={save}
        targetLabel="Englisch"
      />
      <output aria-label="Direction save calls">{calls}</output>
      <output aria-label="Direction save snapshot">{snapshot}</output>
      <fieldset>
        <legend>Test controls</legend>
        <button onClick={() => deferred.current?.resolve()} type="button">
          Resolve direction save
        </button>
        <button
          onClick={() =>
            deferred.current?.reject(new Error('Test direction rejection'))
          }
          type="button"
        >
          Reject direction save
        </button>
      </fieldset>
    </PageLayout>
  );
};
