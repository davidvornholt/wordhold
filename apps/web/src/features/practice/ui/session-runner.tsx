import type { ReviewMode } from '@wordhold/db/schema/practice';
import { type ReactNode, useState } from 'react';
import type { PracticeSession, SubmitResult } from '../schemas/practice-models';
import type { SubmitPayloadData } from '../schemas/submission-schema';
import {
  advanceQueue,
  continueQueue,
  createSessionQueue,
  endSession,
} from '../services/session-queue';
import { CardPractice } from './card-practice';
import { SessionProgress } from './session-progress';
import { SectionCheckpoint, SessionSummary } from './session-summary';

type SessionRunnerProps = {
  readonly session: PracticeSession;
  readonly targetLabel: string;
  readonly mode: ReviewMode;
  readonly emptyMessage: string;
  readonly backControl: ReactNode;
  readonly continueControl?: ReactNode;
  readonly submit: (input: {
    readonly data: SubmitPayloadData;
  }) => Promise<SubmitResult>;
};

export const SessionRunner = ({
  session,
  targetLabel,
  mode,
  emptyMessage,
  backControl,
  continueControl,
  submit,
}: SessionRunnerProps) => {
  const [queue, setQueue] = useState(() => createSessionQueue(session.items));
  const card = queue.pending.at(0);
  const remainingReady = Math.max(
    0,
    session.available.due +
      session.available.firstReviews -
      session.items.length,
  );
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
        continueControl={remainingReady > 0 ? continueControl : undefined}
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
        onNext={(result) =>
          setQueue((current) => advanceQueue(current, card, result))
        }
        repeated={queue.phase === 'after-round'}
        submit={submit}
        targetLabel={targetLabel}
      />
    );
  }

  return (
    <>
      {queue.total === 0 || queue.phase === 'complete' ? null : (
        <SessionProgress
          phase={queue.phase}
          processed={queue.sectionProcessed}
          section={queue.section}
          total={queue.sectionTotal}
          repeatCount={queue.repeatCards.length}
        />
      )}
      {content}
    </>
  );
};
