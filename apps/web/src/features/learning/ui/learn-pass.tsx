import { type ReactNode, useState } from 'react';
import { type CourseSubject, courseNouns } from '../../../shared/directions';
import { CardRail } from '../../../shared/ui/card-rail';
import type { LearnItem } from '../schemas/learning-models';
import { LearnDone } from './learn-done';
import { LearnEntry } from './learn-entry';

type LearnPassProps = {
  readonly items: ReadonlyArray<LearnItem>;
  readonly subject: CourseSubject;
  readonly onIntroduce: (item: LearnItem) => Promise<void>;
  readonly directionLabel: string;
  readonly completionControls: ReactNode;
};

// One bounded section in one direction. Each entry is recorded as met the
// moment it has been written correctly, so leaving halfway keeps what was
// learned and the next section resumes with the rest.
export const LearnPass = ({
  items,
  subject,
  onIntroduce,
  directionLabel,
  completionControls,
}: LearnPassProps) => {
  const [index, setIndex] = useState(0);
  const item = items.at(index);
  const nouns = courseNouns(subject);
  // A terms course has one direction, so naming it adds nothing.
  const shownDirection = subject.kind === 'terms' ? null : directionLabel;
  return (
    <>
      {items.length === 0 ? null : (
        <CardRail
          activeIndex={item === undefined ? null : index}
          activeOutcome={null}
          description={`${index} von ${items.length} ${nouns.dativePlural} kennengelernt${shownDirection === null ? '' : ` · ${shownDirection}`}`}
          label="Kennenlernen"
          ticks={items.map((_, position) =>
            position < index ? ('correct' as const) : null,
          )}
        />
      )}
      {item === undefined ? (
        <LearnDone
          controls={completionControls}
          directionLabel={shownDirection}
          learned={index}
          nouns={nouns}
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
          subject={subject}
        />
      )}
    </>
  );
};
