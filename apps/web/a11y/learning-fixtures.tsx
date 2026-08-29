import { useState } from 'react';
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
    onClick={() => navigateToFixture('unit')}
    type="button"
  >
    ← Unit 3 – Holidays
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

export const LearnFixture = ({
  failFirst = false,
}: {
  failFirst?: boolean;
}) => {
  const [introduced, setIntroduced] = useState<ReadonlyArray<string>>([]);
  const [attempts, setAttempts] = useState(0);
  return (
    <LearningLayout
      backControl={backControl}
      title="Unit 3: Holidays kennenlernen"
    >
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
        targetLanguage="en"
      />
      <output aria-label="Introduced entries">{introduced.length}</output>
      <output aria-label="Introduction attempts">{attempts}</output>
    </LearningLayout>
  );
};

export const LearnDoneFixture = () => (
  <LearningLayout
    backControl={backControl}
    title="Unit 3: Holidays kennenlernen"
  >
    <LearnDone learned={items.length} practiceControl={practiceControl} />
  </LearningLayout>
);
