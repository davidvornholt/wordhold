import { type ReactNode, useState } from 'react';
import type { LearnItem } from '../schemas/learning-models';
import { LearnDone } from './learn-done';
import { LearnWord } from './learn-word';

type LearnPassProps = {
  readonly items: ReadonlyArray<LearnItem>;
  readonly targetLabel: string;
  readonly onIntroduce: (entryId: string) => Promise<void>;
  readonly practiceControl: ReactNode;
};

// Every word of the unit the learner has not met, one after the other. Each is
// recorded as met the moment it has been written correctly, so leaving halfway
// keeps what was learned and coming back resumes with the rest.
export const LearnPass = ({
  items,
  targetLabel,
  onIntroduce,
  practiceControl,
}: LearnPassProps) => {
  const [index, setIndex] = useState(0);
  const item = items.at(index);

  return item === undefined ? (
    <LearnDone learned={index} practiceControl={practiceControl} />
  ) : (
    <LearnWord
      item={item}
      key={item.entryId}
      onLearned={async () => {
        await onIntroduce(item.entryId);
        setIndex(index + 1);
      }}
      position={index + 1}
      targetLabel={targetLabel}
      total={items.length}
    />
  );
};
