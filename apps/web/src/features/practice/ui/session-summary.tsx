import type { ReactNode } from 'react';
import {
  earliestDate,
  formatLearningDate,
} from '../../../shared/dates/learning-date';
import { countNoun } from '../../../shared/format/count';
import { itemsInNextSection } from '../../../shared/session/section-policy';
import { Button } from '../../../shared/ui/button';
import { Callout } from '../../../shared/ui/callout';
import { ManagedHeading } from '../../../shared/ui/managed-heading';
import { cardClass } from '../../../shared/ui/surface-styles';
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

export const SessionSummary = ({
  queue,
  emptyMessage,
  backControl,
  continueControl,
  remainingReady,
  initialNextDueAt = null,
}: SessionSummaryProps) => {
  const ungraded = queue.ungradedCardIds.length;
  const answered = queue.processedCardIds.length;
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
    <section className={`flex flex-col gap-4 ${cardClass}`}>
      <ManagedHeading className="font-display text-xl">
        {heading}
      </ManagedHeading>
      {queue.total === 0 ? null : (
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Bearbeitet</dt>
            <dd className="font-medium">
              {answered} von {countNoun(queue.total, 'Karte', 'Karten')}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Auf Anhieb richtig</dt>
            <dd className="font-medium">{queue.firstTryCorrect}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nach Fehlern richtig</dt>
            <dd className="font-medium">{queue.afterRoundCorrect}</dd>
          </div>
        </dl>
      )}
      {ungraded === 0 ? null : (
        <Callout tone="warning">
          <p className="text-sm">
            {ungraded} {ungraded === 1 ? 'Karte konnte' : 'Karten konnten'}{' '}
            nicht bewertet werden. Lernstand und Termin blieben unverändert.
          </p>
        </Callout>
      )}
      {nextDueAt === null ? null : (
        <Callout tone="positive">
          <p className="eyebrow">
            {reviewIsDue
              ? 'Reguläre Wiederholung fällig'
              : 'Nächster Lerntermin'}
          </p>
          <p className="font-display text-lg">
            <time dateTime={nextDueAt.toISOString()}>
              {formatLearningDate(nextDueAt, now)}
            </time>
          </p>
        </Callout>
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
  <section className={`flex flex-col gap-4 ${cardClass}`}>
    <ManagedHeading className="font-display text-xl">
      Abschnitt {queue.section} abgeschlossen
    </ManagedHeading>
    <p className="text-sm">
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
