import { type ReactNode, useState } from 'react';
import {
  type CourseSubject,
  courseNouns,
  isListCourse,
} from '../../../shared/directions';
import {
  type PrepareExamples,
  withoutExamples,
} from '../../../shared/examples/example-model';
import { useExampleWarmup } from '../../../shared/examples/use-example-warmup';
import { CardRail } from '../../../shared/ui/card-rail';
import type { LearnItem } from '../schemas/learning-models';
import { LearnDone } from './learn-done';
import { LearnEntry } from './learn-entry';

type LearnPassProps = {
  readonly items: ReadonlyArray<LearnItem>;
  readonly subject: CourseSubject;
  readonly onIntroduce: (item: LearnItem) => Promise<void>;
  readonly prepareExamples: PrepareExamples;
  readonly directionLabel: string;
  readonly completionControls: ReactNode;
};

// One bounded section in one direction. Each entry is recorded as met the
// moment it has been written correctly, so leaving halfway keeps what was
// learned and the next section resumes with the rest. The pass shows at once;
// example sentences are prepared in pass order while it runs, the current
// card first.
export const LearnPass = ({
  items,
  subject,
  onIntroduce,
  prepareExamples,
  directionLabel,
  completionControls,
}: LearnPassProps) => {
  const [index, setIndex] = useState(0);
  // A definition or text has no example sentence to show.
  const warmup = useExampleWarmup(
    items,
    isListCourse(subject.kind) ? withoutExamples : prepareExamples,
  );
  const item = warmup.items.at(index);
  const nouns = courseNouns(subject);
  // A subject or collection has one direction, so naming it adds nothing.
  const shownDirection = isListCourse(subject.kind) ? null : directionLabel;
  return (
    <>
      {items.length === 0 ? null : (
        <CardRail
          activeIndex={item === undefined ? null : index}
          activeOutcome={null}
          description={`${index} von ${items.length} ${items.length === 1 ? nouns.singular : nouns.dativePlural} kennengelernt${shownDirection === null ? '' : ` · ${shownDirection}`}`}
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
          examplePending={
            item.example === null && !warmup.isSettled(item.entryId)
          }
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
