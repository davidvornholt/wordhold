import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { useRef, useState } from 'react';
import { CourseLayout } from '../src/features/courses/ui/course-layout';
import { DirectionSettings } from '../src/features/courses/ui/direction-settings';
import { sessionOptions } from '../src/features/practice/services/session-options';
import { PracticeLayout } from '../src/features/practice/ui/practice-layout';
import { SessionStart } from '../src/features/practice/ui/session-start';
import { navigateToFixture } from './fixture-state';

const backControl = (
  <button
    className="w-fit text-muted-foreground text-sm underline"
    onClick={() => navigateToFixture('dashboard')}
    type="button"
  >
    ← Übersicht
  </button>
);

export const PracticeStartFixture = () => (
  <PracticeLayout backControl={backControl} title="English A2: Üben">
    <SessionStart
      options={sessionOptions(['to_target', 'to_native'], 'Englisch')}
      renderStartAction={(option) => (
        <button
          className="w-fit font-medium underline"
          onClick={() => navigateToFixture('practice-session')}
          type="button"
        >
          {option.label}
        </button>
      )}
    />
  </PracticeLayout>
);

// Saving is instant here, so the status line reaches "Gespeichert." the way it
// does against the server.
export const CourseSettingsFixture = () => (
  <CourseLayout backControl={backControl} title="English A2: Einstellungen">
    <DirectionSettings
      initial={['to_target', 'to_native']}
      save={() => Promise.resolve()}
      targetLabel="Englisch"
    />
  </CourseLayout>
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
    <CourseLayout backControl={backControl} title="English A2: Einstellungen">
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
    </CourseLayout>
  );
};
