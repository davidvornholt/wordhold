import type { ReviewMode } from '@wordhold/db/schema/practice';
import { type ReactNode, useState } from 'react';
import { type CourseSubject, isListCourse } from '../../../shared/directions';
import {
  type PrepareExamples,
  withoutExamples,
} from '../../../shared/examples/example-model';
import { useExampleWarmup } from '../../../shared/examples/use-example-warmup';
import { countNoun } from '../../../shared/format/count';
import {
  type PreparePitfalls,
  withoutPitfalls,
} from '../../../shared/pitfalls/pitfall-model';
import { usePitfallWarmup } from '../../../shared/pitfalls/use-pitfall-warmup';
import type { RailOutcome } from '../../../shared/session/rail-outcome';
import { CardRail } from '../../../shared/ui/card-rail';
import { dealCard } from '../../../shared/ui/deal-card';
import {
  type PracticeSession,
  remainingReadyCount,
  type SubmitResult,
} from '../schemas/practice-models';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import {
  advanceQueue,
  continueQueue,
  createSessionQueue,
  endSession,
  type SessionQueue,
} from '../services/session-queue';
import { CardPractice } from './card-practice';
import { SectionCheckpoint, SessionSummary } from './session-summary';

type SessionRunnerProps = {
  readonly session: PracticeSession;
  readonly subject: CourseSubject;
  readonly mode: ReviewMode;
  readonly emptyMessage: string;
  readonly backControl: ReactNode;
  readonly continueControl?: ReactNode;
  readonly prepareExamples: PrepareExamples;
  readonly preparePitfalls: PreparePitfalls;
  readonly submit: (input: {
    readonly data: SubmitPayloadData;
  }) => Promise<SubmitResult>;
};

const railDescription = (queue: SessionQueue): string => {
  if (queue.phase === 'after-round') {
    return `${countNoun(queue.pending.length, 'Karte', 'Karten')} noch einmal`;
  }
  const processed = `${queue.sectionProcessed} von ${countNoun(
    queue.sectionTotal,
    'Karte',
    'Karten',
  )} bearbeitet`;
  return queue.repeatCards.length > 0
    ? `${processed} · ${queue.repeatCards.length} für die Nachrunde`
    : processed;
};

const railProgress = (queue: SessionQueue): string => {
  if (queue.phase === 'after-round') {
    return `${queue.pending.length} noch einmal`;
  }
  const processed = `${queue.sectionProcessed} von ${queue.sectionTotal}`;
  return queue.repeatCards.length > 0
    ? `${processed} · ${queue.repeatCards.length} für die Nachrunde`
    : processed;
};

// The first section goes without a name; only a later one or the
// after-round says where the round is.
const railLabel = (queue: SessionQueue): string | null => {
  if (queue.phase === 'after-round') {
    return 'Nachrunde';
  }
  return queue.section > 1 ? `Abschnitt ${queue.section}` : null;
};

export const SessionRunner = ({
  session,
  subject,
  mode,
  emptyMessage,
  backControl,
  continueControl,
  prepareExamples,
  preparePitfalls,
  submit,
}: SessionRunnerProps) => {
  const [queue, setQueue] = useState(() => createSessionQueue(session.items));
  const [judged, setJudged] = useState<RailOutcome | null>(null);
  // A definition or text has no example sentence or spelling pitfalls.
  const listCourse = isListCourse(subject.kind);
  const warmup = useExampleWarmup(
    session.items,
    listCourse ? withoutExamples : prepareExamples,
  );
  const pitfallsOf = usePitfallWarmup(
    session.items,
    listCourse ? withoutPitfalls : preparePitfalls,
  );
  const head = queue.pending.at(0);
  const card =
    head === undefined
      ? undefined
      : {
          ...head,
          example:
            head.example ??
            warmup.items.find((item) => item.entryId === head.entryId)
              ?.example ??
            null,
          spellingPitfalls: pitfallsOf(head),
        };
  const remainingReady = remainingReadyCount(session);
  let content: ReactNode;
  if (queue.phase === 'checkpoint') {
    content = (
      <SectionCheckpoint
        onContinue={() => setQueue(continueQueue(queue))}
        onFinish={() => setQueue(endSession(queue))}
        queue={queue}
      />
    );
  } else if (card === undefined) {
    content = (
      <SessionSummary
        backControl={backControl}
        continueControl={continueControl}
        emptyMessage={emptyMessage}
        initialNextDueAt={session.available.nextDueAt}
        queue={queue}
        remainingReady={remainingReady}
      />
    );
  } else {
    content = (
      <CardPractice
        item={card}
        key={`${card.cardId}-${card.revision}`}
        mode={mode}
        onJudged={setJudged}
        onNext={(result) => {
          dealCard(() => {
            setJudged(null);
            setQueue((current) => advanceQueue(current, card, result));
          });
        }}
        prepareExamples={warmup.prepareExamples}
        repeated={queue.phase === 'after-round'}
        subject={subject}
        submit={submit}
      />
    );
  }

  return (
    <>
      {queue.total === 0 || queue.phase === 'complete' ? null : (
        <CardRail
          activeIndex={
            card === undefined
              ? null
              : queue.rail.findIndex((tick) => tick.cardId === card.cardId)
          }
          activeOutcome={judged}
          description={railDescription(queue)}
          label={railLabel(queue)}
          progress={railProgress(queue)}
          ticks={queue.rail.map((tick) => tick.outcome)}
        />
      )}
      {content}
    </>
  );
};
