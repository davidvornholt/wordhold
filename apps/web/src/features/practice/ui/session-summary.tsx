import type { ReactNode } from 'react';
import {
  earliestDate,
  formatLearningDate,
} from '../../../shared/dates/learning-date';
import { countNoun } from '../../../shared/format/count';
import type { RailOutcome } from '../../../shared/session/rail-outcome';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import { Button } from '../../../shared/ui/button';
import { Callout } from '../../../shared/ui/callout';
import { CardRail } from '../../../shared/ui/card-rail';
import { ManagedHeading } from '../../../shared/ui/managed-heading';
import type { SessionQueue } from '../services/session-queue';
import { earliestScheduledReview } from '../services/session-queue';

type SessionSummaryProps = {
  readonly queue: SessionQueue;
  readonly emptyMessage: string;
  readonly backControl: ReactNode;
  readonly continueControl?: ReactNode;
  readonly remainingReady: number;
  readonly initialNextDueAt?: Date | null;
};

// How the first pass went, card by card: the rail the sitting started with,
// now complete.
const firstPassOutcomes = (queue: SessionQueue): ReadonlyArray<RailOutcome> =>
  queue.processedCardIds.map((cardId) => {
    if (queue.ungradedCardIds.includes(cardId)) {
      return 'ungraded';
    }
    return queue.missedCardIds.includes(cardId) ? 'wrong' : 'correct';
  });

const Figure = ({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) => (
  <div className="flex flex-col gap-1">
    <dt className="text-muted-foreground text-sm">{label}</dt>
    <dd className="font-display text-3xl tabular-nums leading-none">{value}</dd>
  </div>
);

const NextDue = ({
  nextDueAt,
  now,
  reviewIsDue,
}: {
  readonly nextDueAt: Date;
  readonly now: Date;
  readonly reviewIsDue: boolean;
}) => (
  <div className="flex flex-col gap-1 border-primary border-l-4 pl-4">
    <p className="eyebrow">
      {reviewIsDue ? 'Reguläre Wiederholung fällig' : 'Nächster Lerntermin'}
    </p>
    <p className="font-display text-xl">
      <time dateTime={nextDueAt.toISOString()}>
        {formatLearningDate(nextDueAt, now)}
      </time>
    </p>
  </div>
);

const Outcome = ({ queue }: { readonly queue: SessionQueue }) => {
  const graduated = queue.graduatedCardIds.length;
  return (
    <>
      <CardRail
        current={null}
        description={`${queue.processedCardIds.length} von ${countNoun(
          queue.total,
          'Karte',
          'Karten',
        )}`}
        label="Erster Durchgang"
        outcomes={firstPassOutcomes(queue)}
        total={queue.total}
      />
      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        <Figure
          label="Auf Anhieb richtig"
          value={String(queue.firstTryCorrect)}
        />
        <Figure
          label="Nach Fehlern richtig"
          value={String(queue.afterRoundCorrect)}
        />
        {graduated === 0 ? null : (
          <Figure label="Neu sicher" value={`+${graduated}`} />
        )}
      </dl>
    </>
  );
};

export const SessionSummary = ({
  queue,
  emptyMessage,
  backControl,
  continueControl,
  remainingReady,
  initialNextDueAt = null,
}: SessionSummaryProps) => {
  const ungraded = queue.ungradedCardIds.length;
  const nextDueAt = earliestDate([
    earliestScheduledReview(queue),
    initialNextDueAt,
  ]);
  const now = new Date();
  const reviewIsDue = nextDueAt !== null && nextDueAt <= now;
  const showContinueControl =
    continueControl !== undefined && (remainingReady > 0 || reviewIsDue);
  const heading = queue.total === 0 ? emptyMessage : 'Für jetzt geschafft';

  return (
    <section className="flex animate-rise flex-col gap-8">
      <ManagedHeading className="text-balance font-display text-3xl sm:text-4xl">
        {heading}
      </ManagedHeading>
      {queue.total === 0 ? null : <Outcome queue={queue} />}
      {ungraded === 0 ? null : (
        <Callout tone="warning">
          <p className="text-sm">
            {ungraded} {ungraded === 1 ? 'Karte konnte' : 'Karten konnten'}{' '}
            nicht bewertet werden. Lernstand und Termin blieben unverändert.
          </p>
        </Callout>
      )}
      {nextDueAt === null ? null : (
        <NextDue nextDueAt={nextDueAt} now={now} reviewIsDue={reviewIsDue} />
      )}
      {remainingReady > 0 ? (
        <p className="text-muted-foreground text-sm">
          Danach {remainingReady === 1 ? 'ist' : 'sind'} noch{' '}
          {countNoun(remainingReady, 'Karte', 'Karten')} offen. Die ältesten
          kommen zuerst.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        {showContinueControl ? continueControl : null}
        {backControl}
      </div>
    </section>
  );
};

type SectionCheckpointProps = {
  readonly queue: SessionQueue;
  readonly onContinue: () => void;
  readonly onFinish: () => void;
};

export const SectionCheckpoint = ({
  queue,
  onContinue,
  onFinish,
}: SectionCheckpointProps) => (
  <section className="flex animate-rise flex-col gap-6">
    <ManagedHeading className="text-balance font-display text-3xl sm:text-4xl">
      Abschnitt {queue.section} abgeschlossen
    </ManagedHeading>
    <p className="text-muted-foreground">
      Noch {countNoun(queue.remaining.length, 'Karte', 'Karten')} in dieser
      Auswahl.
    </p>
    <div className="flex flex-wrap gap-3">
      <Button onClick={onContinue}>
        Weitere {itemsInNextSection(queue.remaining.length)} üben
      </Button>
      <Button onClick={onFinish} variant="outline">
        Für jetzt beenden
      </Button>
    </div>
  </section>
);
