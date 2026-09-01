import { useState } from 'react';
import type { LearnItem } from '../src/features/learning/schemas/learning-models';
import { LearnDone } from '../src/features/learning/ui/learn-done';
import { LearnPass } from '../src/features/learning/ui/learn-pass';
import { directionOptions } from '../src/features/practice/services/session-options';
import { SessionStart } from '../src/features/practice/ui/session-start';
import { countNoun } from '../src/shared/format/count';
import { sessionSectionSize } from '../src/shared/session/section-policy';
import { Button } from '../src/shared/ui/button';
import { PageLayout } from '../src/shared/ui/page-layout';
import { fixtureBackControl, fixtureControl } from './fixture-controls';
import { navigateToFixture } from './fixture-state';

const items: ReadonlyArray<LearnItem> = [
  {
    cardId: '00000000-0000-0000-0000-000000000011',
    direction: 'to_target',
    entryId: '00000000-0000-0000-0000-000000000001',
    unitId: '00000000-0000-0000-0000-000000000003',
    targetText: 'memory',
    nativeText: 'die Erinnerung',
    hasAudio: false,
    example: {
      targetText: 'This memory still makes me smile.',
      nativeText: 'Diese Erinnerung bringt mich noch immer zum Lächeln.',
      source: 'textbook',
      hasAudio: false,
    },
    textbookAnswers: ['memory'],
  },
  {
    cardId: '00000000-0000-0000-0000-000000000012',
    direction: 'to_target',
    entryId: '00000000-0000-0000-0000-000000000002',
    unitId: '00000000-0000-0000-0000-000000000003',
    targetText: 'holiday',
    nativeText: 'die Ferien',
    hasAudio: false,
    example: {
      targetText: 'We spend the holidays by the sea.',
      nativeText: 'Wir verbringen die Ferien am Meer.',
      source: 'textbook',
      hasAudio: false,
    },
    textbookAnswers: ['holiday'],
  },
  {
    cardId: '00000000-0000-0000-0000-000000000013',
    direction: 'to_native',
    entryId: '00000000-0000-0000-0000-000000000003',
    unitId: '00000000-0000-0000-0000-000000000003',
    targetText: 'to look (at)',
    nativeText: 'ansehen',
    hasAudio: false,
    example: {
      targetText: 'I look at the map before we leave.',
      nativeText: 'Ich sehe mir die Karte an, bevor wir losfahren.',
      source: 'generated',
      hasAudio: false,
    },
    textbookAnswers: ['to look (at)'],
  },
];

const backControl = fixtureBackControl('Unit 3 – Holidays', 'unit');

const practiceControl = fixtureControl('Jetzt üben', 'practice', 'quiet');

const completionControls = (
  direction: LearnItem['direction'],
  chooseDirection: (direction: LearnItem['direction']) => void,
) => (
  <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap">
    {fixtureControl(
      direction === 'to_target'
        ? 'Jetzt üben · Deutsch → Englisch'
        : 'Jetzt üben · Englisch → Deutsch',
      'practice',
      'primary',
    )}
    {direction === 'to_target' ? (
      <Button onClick={() => chooseDirection('to_native')} variant="outline">
        1 Vokabel kennenlernen · Englisch → Deutsch
      </Button>
    ) : null}
  </div>
);

export const LearnFixture = ({
  failFirst = false,
  direction = 'to_target',
  withAudio = false,
}: {
  failFirst?: boolean;
  direction?: LearnItem['direction'];
  withAudio?: boolean;
}) => {
  const [activeDirection, setActiveDirection] = useState(direction);
  const [introduced, setIntroduced] = useState<ReadonlyArray<string>>([]);
  const [attempts, setAttempts] = useState(0);
  return (
    <PageLayout backControl={backControl} title="Unit 3: Holidays kennenlernen">
      <LearnPass
        completionControls={completionControls(
          activeDirection,
          setActiveDirection,
        )}
        directionLabel={
          activeDirection === 'to_target'
            ? 'Deutsch → Englisch'
            : 'Englisch → Deutsch'
        }
        items={items
          .filter((item) => item.direction === activeDirection)
          .map((item, index) =>
            index === 0 && withAudio
              ? {
                  ...item,
                  hasAudio: true,
                  example:
                    item.example === null
                      ? null
                      : { ...item.example, hasAudio: true },
                }
              : item,
          )}
        key={activeDirection}
        onIntroduce={(item) => {
          const attempt = attempts + 1;
          setAttempts(attempt);
          if (failFirst && attempt === 1) {
            return Promise.reject(new Error('Fixture persistence failure'));
          }
          setIntroduced((current) => [...current, item.cardId]);
          return Promise.resolve();
        }}
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

export const LearnStartFixture = () => (
  <PageLayout backControl={backControl} title="Unit 3: Holidays kennenlernen">
    <SessionStart
      itemNoun={{ singular: 'Vokabel', plural: 'Vokabeln' }}
      options={directionOptions(['to_target', 'to_native'], 'Englisch', [
        { direction: 'to_target', ready: 2 },
        { direction: 'to_native', ready: 1 },
      ])}
      preferenceKey="english-a2:learn"
      renderStartAction={(option, rememberDirection) => (
        <Button
          className="w-fit"
          onClick={() => {
            rememberDirection();
            navigateToFixture(
              option.value === 'to_native' ? 'learn-native' : 'learn',
            );
          }}
        >
          {countNoun(option.cards, 'Vokabel', 'Vokabeln')} kennenlernen
        </Button>
      )}
    />
  </PageLayout>
);

export const LearnDoneFixture = () => (
  <PageLayout backControl={backControl} title="Unit 3: Holidays kennenlernen">
    <LearnDone
      controls={practiceControl}
      directionLabel="Deutsch → Englisch"
      learned={2}
    />
  </PageLayout>
);

export const LearnSectionDoneFixture = () => {
  const [continuations, setContinuations] = useState(0);
  return (
    <PageLayout backControl={backControl} title="Unit 3: Holidays kennenlernen">
      <LearnDone
        controls={
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap">
            {fixtureControl(
              'Jetzt üben · Deutsch → Englisch',
              'practice',
              'primary',
            )}
            <Button
              onClick={() => setContinuations((current) => current + 1)}
              variant="outline"
            >
              Weitere {sessionSectionSize} Vokabeln kennenlernen · Deutsch →
              Englisch
            </Button>
          </div>
        }
        directionLabel="Deutsch → Englisch"
        learned={sessionSectionSize}
      />
      <output aria-label="Continued learning sections">{continuations}</output>
    </PageLayout>
  );
};
