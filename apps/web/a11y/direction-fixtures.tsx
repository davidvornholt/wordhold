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
