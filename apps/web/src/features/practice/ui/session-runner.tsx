import type { ReviewMode } from '@wordhold/db/schema/practice';
import { type ReactNode, useState } from 'react';
import { ProgressMeter } from '../../../shared/ui/progress-meter';
import type {
  PracticeSession,
  SubmitResult,
} from '../services/practice-service';
import { submitAnswer } from '../services/server-fns';
import { advanceQueue, createSessionQueue } from '../services/session-queue';
import { CardPractice } from './card-practice';
import { PracticeEmpty } from './practice-layout';

type SessionRunnerProps = {
  readonly session: PracticeSession;
  readonly targetLabel: string;
  readonly mode: ReviewMode;
  // What to say when the sitting had nothing in it. The scheduled queue and a
  // drilled unit are empty for different reasons.
  readonly emptyMessage: string;
  readonly backControl: ReactNode;
};

// Works one sitting's queue, whatever fed it. The scheduled queue and a unit
// drill differ only in where the cards came from and in the mode each answer
// is logged under.
export const SessionRunner = ({
  session,
  targetLabel,
  mode,
  emptyMessage,
  backControl,
}: SessionRunnerProps) => {
  const [queue, setQueue] = useState(() => createSessionQueue(session.items));
  const [visibleResult, setVisibleResult] = useState<SubmitResult | null>(null);
  const card = queue.pending.at(0);
  const visibleQueue =
    card === undefined || visibleResult === null
      ? queue
      : advanceQueue(queue, card, visibleResult);
  const cardLabel = queue.total === 1 ? 'Karte' : 'Karten';

  return (
    <>
      {queue.total === 0 ? null : (
        <ProgressMeter
          accessibleName="Fortschritt"
          description={`${visibleQueue.settled} von ${queue.total} ${cardLabel} bearbeitet`}
          total={queue.total}
          value={visibleQueue.settled}
        />
      )}
      {card === undefined ? (
        <PracticeEmpty
          backControl={backControl}
          correct={queue.correct}
          emptyMessage={emptyMessage}
          total={queue.total}
          ungraded={queue.ungraded}
          wrong={queue.wrong}
        />
      ) : (
        <CardPractice
          item={card}
          key={`${card.cardId}-${card.revision}`}
          mode={mode}
          onNext={(result) => {
            setQueue((current) => advanceQueue(current, card, result));
            setVisibleResult(null);
          }}
          onResult={setVisibleResult}
          repeated={card.repeated}
          submit={submitAnswer}
          targetLabel={targetLabel}
        />
      )}
    </>
  );
};
