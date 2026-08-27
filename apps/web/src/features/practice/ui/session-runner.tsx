import type { ReviewMode } from '@wordhold/db/schema/practice';
import { type ReactNode, useState } from 'react';
import type { PracticeSession } from '../services/practice-service';
import { submitAnswer } from '../services/server-fns';
import { advanceQueue, createSessionQueue } from '../services/session-queue';
import { CardPractice } from './card-practice';
import { PracticeEmpty } from './practice-layout';
import { SessionProgress } from './session-progress';

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
  const card = queue.pending.at(0);

  return (
    <>
      {queue.total === 0 ? null : (
        <SessionProgress settled={queue.settled} total={queue.total} />
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
          onNext={(result) =>
            setQueue((current) => advanceQueue(current, card, result))
          }
          repeated={card.repeated}
          submit={submitAnswer}
          targetLabel={targetLabel}
        />
      )}
    </>
  );
};
