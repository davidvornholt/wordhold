import { sessionOptions } from '../src/features/practice/services/session-options';
import { PracticeLayout } from '../src/features/practice/ui/practice-layout';
import { SessionStart } from '../src/features/practice/ui/session-start';
import { navigateToFixture } from './fixture-state';

export const DrillStartFixture = () => (
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
