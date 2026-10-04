import type { ReactNode } from 'react';
import { countNoun } from '../../../shared/format/count';
import type { RailOutcome } from '../../../shared/session/rail-outcome';
import { Callout } from '../../../shared/ui/callout';
import { CardRail } from '../../../shared/ui/card-rail';
import { ManagedHeading } from '../../../shared/ui/managed-heading';
import { Figure } from './session-summary';

type SentenceSummaryProps = {
  // One outcome per sentence asked, in asking order.
  readonly outcomes: ReadonlyArray<RailOutcome>;
  // Why nothing was asked, shown when no sentence was.
  readonly emptyReason: string;
  readonly backControl: ReactNode;
  readonly continueControl: ReactNode;
};

const count = (
  outcomes: ReadonlyArray<RailOutcome>,
  wanted: RailOutcome,
): number => outcomes.filter((outcome) => outcome === wanted).length;

export const SentenceSummary = ({
  outcomes,
  emptyReason,
  backControl,
  continueControl,
}: SentenceSummaryProps) => {
  if (outcomes.length === 0) {
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
  const ungraded = count(outcomes, 'ungraded');
  return (
    <section className="flex animate-rise flex-col gap-8">
      <ManagedHeading className="text-balance font-display text-3xl sm:text-4xl">
        Runde beendet
      </ManagedHeading>
      <CardRail
        activeIndex={null}
        activeOutcome={null}
        description={countNoun(outcomes.length, 'Satz', 'Sätze')}
        label="Diese Runde"
        ticks={outcomes}
      />
      <dl className="grid grid-cols-2 gap-6">
        <Figure label="Richtig" value={String(count(outcomes, 'correct'))} />
        <Figure
          label="Noch nicht richtig"
          value={String(count(outcomes, 'wrong'))}
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
