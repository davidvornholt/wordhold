import { sessionOptions } from '../src/features/practice/services/session-options';
import { PracticeLayout } from '../src/features/practice/ui/practice-layout';
import { SessionStart } from '../src/features/practice/ui/session-start';
import { navigateToFixture } from './fixture-state';

export const StudyStartFixture = () => (
  <PracticeLayout
    backControl={
      <button
        className="w-fit text-muted-foreground text-sm underline"
        onClick={() => navigateToFixture('unit')}
        type="button"
      >
        ← Unit 3 – Holidays
      </button>
    }
    title="Unit 3 – Holidays üben"
  >
    <SessionStart
      options={sessionOptions(['to_target', 'to_native'], 'Englisch', [
        { direction: 'to_target', ready: 16 },
        { direction: 'to_native', ready: 16 },
        { direction: 'both', ready: 32 },
      ])}
      preferenceKey="english-a2-study"
      renderStartAction={(option, rememberDirection) => (
        <button
          className="min-h-11 w-fit bg-primary px-4 py-2 font-medium text-primary-foreground text-sm"
          onClick={() => {
            rememberDirection();
            navigateToFixture('study-session');
          }}
          type="button"
        >
          {option.cards} Karten starten
        </button>
      )}
    />
  </PracticeLayout>
);
