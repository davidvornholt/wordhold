import { useState } from 'react';
import { UnitList } from '../src/features/courses/ui/unit-list';
import type { LearnItem } from '../src/features/learning/schemas/learning-models';
import { LearnDone } from '../src/features/learning/ui/learn-done';
import { LearnPass } from '../src/features/learning/ui/learn-pass';
import { LearningLayout } from '../src/features/learning/ui/learning-layout';
import { navigateToFixture } from './fixture-state';

const items: ReadonlyArray<LearnItem> = [
  {
    entryId: '00000000-0000-0000-0000-000000000001',
    targetText: 'memory',
    nativeText: 'die Erinnerung',
    hasAudio: false,
    textbookAnswers: ['memory'],
  },
  {
    entryId: '00000000-0000-0000-0000-000000000002',
    targetText: 'to look (at)',
    nativeText: 'ansehen',
    hasAudio: false,
    textbookAnswers: ['to look (at)'],
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

const practiceControl = (
  <button
    className="w-fit font-medium text-sm underline"
    onClick={() => navigateToFixture('practice')}
    type="button"
  >
    Jetzt üben
  </button>
);

export const LearnUnitsFixture = () => (
  <LearningLayout backControl={backControl} title="English A2: Lernen">
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
        unit.unlearned === 0 ? null : (
          <button
            className="whitespace-nowrap font-medium text-sm underline"
            onClick={() => navigateToFixture('learn')}
            type="button"
          >
            {unit.unlearned} lernen
          </button>
        )
      }
      units={[
        {
          id: '00000000-0000-0000-0000-000000000003',
          name: 'Unit 3 – Holidays',
          words: 18,
          unlearned: 2,
        },
        {
          id: '00000000-0000-0000-0000-000000000004',
          name: 'Unit 2 – School',
          words: 16,
          unlearned: 0,
        },
      ]}
    />
  </LearningLayout>
);

export const LearnFixture = ({
  failFirst = false,
}: {
  failFirst?: boolean;
}) => {
  const [introduced, setIntroduced] = useState<ReadonlyArray<string>>([]);
  const [attempts, setAttempts] = useState(0);
  return (
    <LearningLayout backControl={backControl} title="Unit 3 – Holidays lernen">
      <LearnPass
        items={items}
        onIntroduce={(entryId) => {
          const attempt = attempts + 1;
          setAttempts(attempt);
          if (failFirst && attempt === 1) {
            return Promise.reject(new Error('Fixture persistence failure'));
          }
          setIntroduced((current) => [...current, entryId]);
          return Promise.resolve();
        }}
        practiceControl={practiceControl}
        targetLabel="Englisch"
      />
      <output aria-label="Introduced words">{introduced.length}</output>
      <output aria-label="Introduction attempts">{attempts}</output>
    </LearningLayout>
  );
};

export const LearnDoneFixture = () => (
  <LearningLayout backControl={backControl} title="Unit 3 – Holidays lernen">
    <LearnDone learned={items.length} practiceControl={practiceControl} />
  </LearningLayout>
);
