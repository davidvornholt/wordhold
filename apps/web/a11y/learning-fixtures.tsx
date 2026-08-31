import { useState } from 'react';
import type { LearnItem } from '../src/features/learning/schemas/learning-models';
import { LearnDone } from '../src/features/learning/ui/learn-done';
import { LearnPass } from '../src/features/learning/ui/learn-pass';
import { PageLayout } from '../src/shared/ui/page-layout';
import { fixtureBackControl, fixtureControl } from './fixture-controls';

const items: ReadonlyArray<LearnItem> = [
  {
    cardId: '00000000-0000-0000-0000-000000000011',
    direction: 'to_target',
    entryId: '00000000-0000-0000-0000-000000000001',
    targetText: 'memory',
    nativeText: 'die Erinnerung',
    hasAudio: false,
    textbookAnswers: ['memory'],
  },
  {
    cardId: '00000000-0000-0000-0000-000000000012',
    direction: 'to_native',
    entryId: '00000000-0000-0000-0000-000000000002',
    targetText: 'to look (at)',
    nativeText: 'ansehen',
    hasAudio: false,
    textbookAnswers: ['to look (at)'],
  },
];

const backControl = fixtureBackControl('Unit 3 – Holidays', 'unit');

const practiceControl = fixtureControl('Jetzt üben', 'practice', 'quiet');

export const LearnFixture = ({
  failFirst = false,
}: {
  failFirst?: boolean;
}) => {
  const [introduced, setIntroduced] = useState<ReadonlyArray<string>>([]);
  const [attempts, setAttempts] = useState(0);
  return (
    <PageLayout backControl={backControl} title="Unit 3: Holidays kennenlernen">
      <LearnPass
        items={items}
        onIntroduce={(cardId) => {
          const attempt = attempts + 1;
          setAttempts(attempt);
          if (failFirst && attempt === 1) {
            return Promise.reject(new Error('Fixture persistence failure'));
          }
          setIntroduced((current) => [...current, cardId]);
          return Promise.resolve();
        }}
        practiceControl={practiceControl}
        targetLabel="Englisch"
        targetLanguage="en"
      />
      <output aria-label="Introduced directions" className="sr-only">
        {introduced.length}
      </output>
      <output aria-label="Introduction attempts" className="sr-only">
        {attempts}
      </output>
    </PageLayout>
  );
};

export const LearnDoneFixture = () => (
  <PageLayout backControl={backControl} title="Unit 3: Holidays kennenlernen">
    <LearnDone learned={items.length} practiceControl={practiceControl} />
  </PageLayout>
);
