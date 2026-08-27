import { learnedWords } from '../src/features/courses/schemas/course-units';
import { UnitList } from '../src/features/courses/ui/unit-list';
import { sessionOptions } from '../src/features/practice/services/session-options';
import { PracticeLayout } from '../src/features/practice/ui/practice-layout';
import { SessionStart } from '../src/features/practice/ui/session-start';
import { navigateToFixture } from './fixture-state';

const units = [
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Unit 3 – Holidays',
    words: 18,
    unlearned: 2,
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Unit 4 – Sport',
    words: 12,
    unlearned: 12,
  },
];

const backControl = (
  <button
    className="w-fit text-muted-foreground text-sm underline"
    onClick={() => navigateToFixture('dashboard')}
    type="button"
  >
    ← Übersicht
  </button>
);

// A unit whose words are all still unmet offers nothing to drill, which is the
// state the second unit here holds.
export const DrillUnitsFixture = () => (
  <PracticeLayout backControl={backControl} title="English A2: Einheit üben">
    <p className="text-muted-foreground text-sm">
      Für die Arbeit morgen. Eine Einheit am Stück, unabhängig davon, was heute
      fällig wäre. Wörter, die noch nicht dran waren, behalten dabei ihren
      Termin.
    </p>
    <UnitList
      importAction={
        <button
          className="w-fit text-sm underline"
          onClick={() => navigateToFixture('import')}
          type="button"
        >
          Seite fotografieren
        </button>
      }
      renderAction={(unit) =>
        learnedWords(unit) === 0 ? null : (
          <button
            className="whitespace-nowrap font-medium text-sm underline"
            onClick={() => navigateToFixture('drill-start')}
            type="button"
          >
            {learnedWords(unit)} üben
          </button>
        )
      }
      units={units}
    />
  </PracticeLayout>
);

export const DrillStartFixture = () => (
  <PracticeLayout
    backControl={
      <button
        className="w-fit text-muted-foreground text-sm underline"
        onClick={() => navigateToFixture('drill-units')}
        type="button"
      >
        ← Einheiten
      </button>
    }
    title="Unit 3 – Holidays üben"
  >
    <SessionStart
      options={sessionOptions(['to_target', 'to_native'], 'Englisch')}
      renderStartAction={(option) => (
        <button
          className="w-fit font-medium underline"
          onClick={() => navigateToFixture('drill-session')}
          type="button"
        >
          {option.label}
        </button>
      )}
    />
  </PracticeLayout>
);
