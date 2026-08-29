import type { LanguageCode } from '@wordhold/db/schema/courses';
import { type ReactNode, useState } from 'react';
import { ProgressMeter } from '../../../shared/ui/progress-meter';
import type { LearnItem } from '../schemas/learning-models';
import { LearnDone } from './learn-done';
import { LearnEntry } from './learn-entry';

type LearnPassProps = {
  readonly items: ReadonlyArray<LearnItem>;
  readonly targetLanguage: LanguageCode;
  readonly targetLabel: string;
  readonly onIntroduce: (cardId: string) => Promise<void>;
  readonly practiceControl: ReactNode;
};

// Every entry of the unit the learner has not met, one after the other. Each is
// recorded as met the moment it has been written correctly, so leaving halfway
// keeps what was learned and coming back resumes with the rest.
export const LearnPass = ({
  items,
  targetLanguage,
  targetLabel,
  onIntroduce,
  practiceControl,
}: LearnPassProps) => {
  const [index, setIndex] = useState(0);
  const item = items.at(index);
  const directionLabel =
    items.length === 1 ? 'Abfragerichtung' : 'Abfragerichtungen';

  return (
    <>
      {items.length === 0 ? null : (
        <ProgressMeter
          accessibleName="Lernfortschritt"
          description={`${index} von ${items.length} ${directionLabel} kennengelernt`}
          total={items.length}
          value={index}
        />
      )}
      {item === undefined ? (
        <LearnDone learned={index} practiceControl={practiceControl} />
      ) : (
        <LearnEntry
          item={item}
          key={item.cardId}
          onLearned={async () => {
            await onIntroduce(item.cardId);
            setIndex(index + 1);
          }}
          targetLanguage={targetLanguage}
          targetLabel={targetLabel}
        />
      )}
    </>
  );
};
