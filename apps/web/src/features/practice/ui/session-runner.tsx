import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReviewMode } from '@wordhold/db/schema/practice';
import { type ReactNode, useState } from 'react';
import type { PrepareExamples } from '../../../shared/examples/example-model';
import { countNoun } from '../../../shared/format/count';
import { ProgressMeter } from '../../../shared/ui/progress-meter';
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
} from '../services/session-queue';
import { CardPractice } from './card-practice';
import { SectionCheckpoint, SessionSummary } from './session-summary';

type SessionRunnerProps = {
  readonly session: PracticeSession;
  readonly targetLabel: string;
  readonly targetLanguage: LanguageCode;
  readonly mode: ReviewMode;
  readonly emptyMessage: string;
  readonly backControl: ReactNode;
  readonly continueControl?: ReactNode;
  readonly prepareExamples: PrepareExamples;
  readonly submit: (input: {
    readonly data: SubmitPayloadData;
  }) => Promise<SubmitResult>;
};

export const SessionRunner = ({
  session,
  targetLabel,
  targetLanguage,
  mode,
  emptyMessage,
  backControl,
  continueControl,
  prepareExamples,
  submit,
}: SessionRunnerProps) => {
  const [queue, setQueue] = useState(() => createSessionQueue(session.items));
  const card = queue.pending.at(0);
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
        onNext={(result) =>
          setQueue((current) => advanceQueue(current, card, result))
        }
        prepareExamples={prepareExamples}
        repeated={queue.phase === 'after-round'}
        submit={submit}
        targetLabel={targetLabel}
        targetLanguage={targetLanguage}
      />
    );
  }

  return (
    <>
      {queue.total === 0 || queue.phase === 'complete' ? null : (
        <div className="flex flex-col gap-1.5">
          <p className="font-medium text-sm">
            {queue.phase === 'after-round'
              ? 'Nachrunde'
              : `Abschnitt ${queue.section}`}
          </p>
          <ProgressMeter
            accessibleName="Fortschritt"
            description={`${queue.sectionProcessed} von ${countNoun(
              queue.sectionTotal,
              'Karte',
              'Karten',
            )} bearbeitet${
              queue.repeatCards.length > 0
                ? ` · ${queue.repeatCards.length} für die Nachrunde`
                : ''
            }`}
            total={queue.sectionTotal}
            value={queue.sectionProcessed}
          />
        </div>
      )}
      {content}
    </>
  );
};
