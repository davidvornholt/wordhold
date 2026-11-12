import type { ReactNode } from 'react';
import { useOwnerTimeZone } from '../../../shared/dates/owner-time-zone';
import { formatShortDate } from '../../../shared/dates/zoned-format';
import { type CourseSubject, directionLabel } from '../../../shared/directions';
import {
  cardPrompt,
  foreignPromptLanguage,
} from '../../../shared/practice/card-texts';
import { cardListClass } from '../../../shared/ui/surface-styles';
import type { ExamReadiness, RoundScore } from '../schemas/exam-models';
import { roundStatus } from './exam-figures';

type MissedCardsProps = {
  readonly readiness: ExamReadiness;
  readonly subject: CourseSubject;
  readonly practiceAction: ReactNode;
};

// Only what each card asks, so practising them right after is still a
// question and not a reread of the answers.
export const MissedCards = ({
  readiness,
  subject,
  practiceAction,
}: MissedCardsProps) => {
  if (readiness.lastRound === null) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl">In der letzten Runde falsch</h2>
      {readiness.missed.length === 0 ? (
        <p className="text-sm">
          Keine Karte – in der letzten Runde war alles richtig.
        </p>
      ) : (
        <>
          <ul className={cardListClass}>
            {readiness.missed.map((card) => (
              <li className="flex flex-col gap-0.5 px-4 py-3" key={card.cardId}>
                <span
                  className="line-clamp-2 break-words font-medium"
                  lang={foreignPromptLanguage(
                    card.direction,
                    subject.targetLanguage,
                  )}
                >
                  {cardPrompt(card)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {directionLabel(card.direction, subject)}
                </span>
              </li>
            ))}
          </ul>
          {practiceAction}
        </>
      )}
    </section>
  );
};

export const RoundHistory = ({
  rounds,
  openRoundId,
}: {
  readonly rounds: ReadonlyArray<RoundScore>;
  readonly openRoundId: string | null;
}) => {
  const timeZone = useOwnerTimeZone();
  if (rounds.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl">Runden</h2>
      <ol className={cardListClass}>
        {rounds.map((round) => (
          <li
            className="flex flex-wrap justify-between gap-x-4 px-4 py-3 text-sm"
            key={round.id}
          >
            <span>{formatShortDate(round.startedAt, timeZone)}</span>
            <span>{roundStatus(round, round.id === openRoundId)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
};
