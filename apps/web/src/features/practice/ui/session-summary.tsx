import type { ReactNode } from 'react';
import {
  earliestDate,
  formatLearningDate,
} from '../../../shared/dates/learning-date';
import { practiceSectionSize } from '../../../shared/practice/session-policy';
import type { SessionQueue } from '../services/session-queue';
import { earliestScheduledReview } from '../services/session-queue';
import { ManagedStepHeading } from './managed-step-heading';

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
  const cardLabel = queue.total === 1 ? 'Karte' : 'Karten';
  const nextDueAt = earliestDate([
    earliestScheduledReview(queue),
    initialNextDueAt,
  ]);
  const heading = queue.total === 0 ? emptyMessage : 'Für jetzt geschafft';

  return (
    <section className="flex flex-col gap-4 border border-border bg-card p-6">
      <ManagedStepHeading className="font-display text-xl">
        {heading}
      </ManagedStepHeading>
      {queue.total === 0 ? null : (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Bearbeitet</dt>
            <dd className="font-medium">
              {answered} von {queue.total} {cardLabel}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Auf Anhieb richtig</dt>
            <dd className="font-medium">{queue.firstTryCorrect}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">In der Nachrunde richtig</dt>
            <dd className="font-medium">{queue.afterRoundCorrect}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Weiterhin unsicher</dt>
            <dd className="font-medium">{queue.deferred.length}</dd>
          </div>
        </dl>
      )}
      {ungraded === 0 ? null : (
        <p className="border-warning-foreground border-l-4 bg-warning p-3 text-sm">
          {ungraded} {ungraded === 1 ? 'Karte konnte' : 'Karten konnten'} nicht
          bewertet werden. Lernstand und Termin blieben unverändert.
        </p>
      )}
      {nextDueAt === null ? null : (
        <aside className="border-primary border-l-4 bg-accent p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Nächster Lerntermin
          </p>
          <p className="font-display text-lg">
            <time dateTime={nextDueAt.toISOString()}>
              {formatLearningDate(nextDueAt)}
            </time>
          </p>
        </aside>
      )}
      {remainingReady > 0 ? (
        <p className="text-muted-foreground text-sm">
          Danach sind noch {remainingReady} Karten offen. Die ältesten kommen
          zuerst.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        {continueControl}
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
  <section className="flex flex-col gap-4 border border-border bg-card p-6">
    <ManagedStepHeading className="font-display text-xl">
      Abschnitt {queue.section} abgeschlossen
    </ManagedStepHeading>
    <p className="text-sm">
      Noch {queue.remaining.length} Karten in dieser Auswahl.
      {queue.deferred.length > 0
        ? ` ${queue.deferred.length} unsichere Karten bleiben im Lernplan.`
        : ''}
    </p>
    <div className="flex flex-wrap gap-3">
      <button
        className="min-h-11 bg-primary px-4 py-2 font-medium text-primary-foreground text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={onContinue}
        type="button"
      >
        Weitere {Math.min(practiceSectionSize, queue.remaining.length)} üben
      </button>
      <button
        className="min-h-11 border border-input px-4 py-2 text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={onFinish}
        type="button"
      >
        Für jetzt beenden
      </button>
    </div>
  </section>
);
