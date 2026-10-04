import type { ReactNode } from 'react';
import { countNoun } from '../../../shared/format/count';
import { Callout } from '../../../shared/ui/callout';
import { CardRail } from '../../../shared/ui/card-rail';
import { ManagedHeading } from '../../../shared/ui/managed-heading';
import type { SentenceRoundCounts } from '../services/sentence-round';
import { Figure } from './session-summary';

type SentenceSummaryProps = {
  readonly counts: SentenceRoundCounts;
  // Why nothing was asked, shown when no sentence was.
  readonly emptyReason: string;
  readonly backControl: ReactNode;
  readonly continueControl: ReactNode;
};

export const SentenceSummary = ({
  counts,
  emptyReason,
  backControl,
  continueControl,
}: SentenceSummaryProps) => {
  if (counts.firstPass.length === 0) {
    return (
      <section className="flex animate-rise flex-col gap-6">
        <ManagedHeading className="text-balance font-display text-3xl sm:text-4xl">
          Noch keine Sätze zum Übersetzen
        </ManagedHeading>
        <p className="text-muted-foreground">{emptyReason}</p>
        <div className="flex flex-wrap items-center gap-4">{backControl}</div>
      </section>
    );
  }
  const { ungraded } = counts;
  return (
    <section className="flex animate-rise flex-col gap-8">
      <ManagedHeading className="text-balance font-display text-3xl sm:text-4xl">
        Runde beendet
      </ManagedHeading>
      <CardRail
        activeIndex={null}
        activeOutcome={null}
        description={countNoun(counts.firstPass.length, 'Satz', 'Sätze')}
        label="Erster Durchgang"
        ticks={counts.firstPass}
      />
      <dl className="grid grid-cols-2 gap-6">
        <Figure
          label="Auf Anhieb richtig"
          value={String(counts.firstTryCorrect)}
        />
        <Figure
          label="Nach Fehlern richtig"
          value={String(counts.afterRoundCorrect)}
        />
      </dl>
      {ungraded === 0 ? null : (
        <Callout tone="warning">
          <p className="text-sm">
            {ungraded === 1 ? 'Ein Satz konnte' : `${ungraded} Sätze konnten`}{' '}
            nicht geprüft werden.
          </p>
        </Callout>
      )}
      <div className="flex flex-wrap items-center gap-4">
        {continueControl}
        {backControl}
      </div>
    </section>
  );
};
