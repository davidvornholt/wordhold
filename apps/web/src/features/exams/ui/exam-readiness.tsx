import type { ReactNode } from 'react';
import { useOwnerTimeZone } from '../../../shared/dates/owner-time-zone';
import { formatShortDate } from '../../../shared/dates/zoned-format';
import { type CourseSubject, directionLabel } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import {
  cardCompactClass,
  cardListClass,
} from '../../../shared/ui/surface-styles';
import type { ExamReadiness, RoundScore } from '../schemas/exam-models';
import {
  roundStatus,
  scorePercent,
  scoreText,
  trendText,
} from './exam-figures';

const Figure = ({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}) => (
  <div className={`flex flex-col gap-1 ${cardCompactClass}`}>
    <dt className="text-muted-foreground text-sm">{label}</dt>
    <dd className="font-display font-semibold text-2xl">{value}</dd>
    <dd className="text-sm">{detail}</dd>
  </div>
);

// The numbers only. Whether that is enough for the test is the learner's
// call, so Wordhold gives no verdict.
export const ExamReadinessFigures = ({
  readiness,
}: {
  readonly readiness: ExamReadiness;
}) => {
  const timeZone = useOwnerTimeZone();
  const { lastRound, previousRound, rightTwice } = readiness;
  if (lastRound === null) {
    return (
      <p className="text-muted-foreground text-sm">
        Sobald du eine Runde abgeschlossen hast, steht hier, wie viele Karten du
        richtig hattest.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid gap-3 sm:grid-cols-3">
        <Figure
          detail={`${scoreText(lastRound)} · ${formatShortDate(lastRound.startedAt, timeZone)}`}
          label="Letzte Runde"
          value={`${scorePercent(lastRound)} %`}
        />
        {previousRound === null ? null : (
          <Figure
            detail={`Davor: ${scoreText(previousRound)} (${scorePercent(previousRound)} %)`}
            label="Entwicklung"
            value={trendText(lastRound, previousRound)}
          />
        )}
        {rightTwice === null ? null : (
          <Figure
            detail={`von ${countNoun(lastRound.total, 'Karte', 'Karten')} der letzten Runde`}
            label="Zweimal hintereinander richtig"
            value={String(rightTwice)}
          />
        )}
      </dl>
      {previousRound === null ? (
        <p className="text-muted-foreground text-sm">
          Nach einer zweiten abgeschlossenen Runde siehst du hier auch, wie sich
          dein Ergebnis entwickelt und welche Karten du zweimal hintereinander
          richtig hattest.
        </p>
      ) : null}
    </div>
  );
};

type MissedCardsProps = {
  readonly readiness: ExamReadiness;
  readonly subject: CourseSubject;
  readonly practiceAction: ReactNode;
};

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
                <span className="break-words font-medium">
                  {card.targetText}
                </span>
                <span className="line-clamp-2 break-words text-muted-foreground text-sm">
                  {card.nativeText}
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
