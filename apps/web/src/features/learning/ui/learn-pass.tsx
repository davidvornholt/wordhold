import type { LanguageCode } from '@wordhold/db/schema/courses';
import { type ReactNode, useState } from 'react';
import { CardRail } from '../../../shared/ui/card-rail';
import type { LearnItem } from '../schemas/learning-models';
import { LearnDone } from './learn-done';
import { LearnEntry } from './learn-entry';

type LearnPassProps = {
  readonly items: ReadonlyArray<LearnItem>;
  readonly targetLanguage: LanguageCode;
  readonly targetLabel: string;
  readonly onIntroduce: (item: LearnItem) => Promise<void>;
  readonly directionLabel: string;
  readonly completionControls: ReactNode;
};

// One bounded section in one direction. Each entry is recorded as met the
// moment it has been written correctly, so leaving halfway keeps what was
// learned and the next section resumes with the rest.
export const LearnPass = ({
  items,
  targetLanguage,
  targetLabel,
  onIntroduce,
  directionLabel,
  completionControls,
}: LearnPassProps) => {
  const [index, setIndex] = useState(0);
  const item = items.at(index);
  return (
    <>
      {items.length === 0 ? null : (
        <CardRail
          current={null}
          description={`${index} von ${items.length} Vokabeln kennengelernt · ${directionLabel}`}
          label="Kennenlernen"
          outcomes={Array.from({ length: index }, () => 'correct' as const)}
          total={items.length}
        />
      )}
      {item === undefined ? (
        <LearnDone
          controls={completionControls}
          directionLabel={directionLabel}
          learned={index}
        />
      ) : (
        <LearnEntry
          deck={items.length - index - 1}
          item={item}
          key={item.cardId}
          onLearned={async () => {
            await onIntroduce(item);
            setIndex(index + 1);
          }}
          targetLanguage={targetLanguage}
          targetLabel={targetLabel}
        />
      )}
    </>
  );
};
