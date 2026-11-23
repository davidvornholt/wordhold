import { type ReactNode, type RefObject, type SubmitEvent, useId } from 'react';
import type { CourseNouns } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { ActionBar } from '../../../shared/ui/action-bar';
import { Button } from '../../../shared/ui/button';
import { DeckEdges } from '../../../shared/ui/deck-edges';
import {
  cardListClass,
  practiceCardClass,
} from '../../../shared/ui/surface-styles';
import { VerdictMark } from '../../../shared/ui/verdict-mark';
import type { EntryCardState } from './use-entry-card';

type EntryCardProps = {
  readonly card: Pick<
    EntryCardState<unknown>,
    'busy' | 'failed' | 'filed' | 'held' | 'status'
  >;
  readonly nouns: CourseNouns;
  readonly submittable: boolean;
  readonly onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  readonly finish: () => void;
  // Names the live status for screen readers, such as "Status beim
  // Eintragen einer Vokabel".
  readonly statusLabel: string;
  // Whether Enter in the last field files the card, which "Eintragen" then
  // shows. A text takes Enter as a new line.
  readonly enterFiles: boolean;
  readonly submitRef?: RefObject<HTMLButtonElement | null>;
  // The fields written on the card.
  readonly children: ReactNode;
};

// What takes part in filing an entry (fileCard): the card shares its name
// with the newest row, which it sinks into, and the rows filed before
// keep theirs as they move down to make room. Rows further down may be
// scrolled out of the dialog, which a transition would not clip, so they
// simply move. A row that is n-th before the update is (n+1)-th after it.
const filingCardClass = 'filing-card:[view-transition-name:filing-entry]';
const filedRowClass =
  'filing-card:nth-[-n+5]:[view-transition-name:match-element] filing-row:not-first:nth-[-n+6]:[view-transition-name:match-element] filing-row:first:[view-transition-name:filing-entry]';

const statusTone = (card: EntryCardProps['card']) => {
  if (card.failed) {
    return 'text-destructive';
  }
  return card.held ? 'text-warning-foreground' : 'text-muted-foreground';
};

// The top card of a stack of blank index cards, and the entries filed from
// it below. Both ways on sit side by side where the typing ends: "Eintragen"
// files the entry and takes the next card, "Fertig" files it and leaves.
// The fields are mounted anew for each card, so whatever a field kept of the
// last entry, such as a proposal's hint, goes with it.
export const EntryCard = ({
  card,
  nouns,
  submittable,
  onSubmit,
  finish,
  statusLabel,
  enterFiles,
  submitRef,
  children,
}: EntryCardProps) => (
  <div className="flex flex-col gap-8">
    <div className="relative">
      <DeckEdges count={2} />
      <form
        className={`${filingCardClass} relative flex flex-col gap-6 px-5 pt-5 pb-4 sm:px-8 sm:pt-7 sm:pb-6 ${practiceCardClass}`}
        onSubmit={onSubmit}
      >
        <div
          className="flex animate-ink flex-col gap-4"
          key={card.filed.length}
        >
          {children}
        </div>
        <div className="flex flex-col gap-2">
          <ActionBar
            primary={
              <Button
                aria-keyshortcuts={enterFiles ? 'Enter' : undefined}
                disabled={!submittable}
                ref={submitRef}
                type="submit"
              >
                Eintragen
                {enterFiles ? (
                  <span
                    aria-hidden={true}
                    className="pointer-fine:inline hidden border border-primary-foreground/40 px-1 text-primary-foreground text-xs"
                  >
                    ↵
                  </span>
                ) : null}
              </Button>
            }
            secondary={
              <Button
                disabled={card.busy}
                onClick={finish}
                variant={card.held ? 'destructive' : 'text'}
              >
                {card.held ? 'Verwerfen' : 'Fertig'}
              </Button>
            }
          />
          <output
            aria-label={statusLabel}
            className={`min-h-5 text-sm ${statusTone(card)}`}
          >
            {card.status}
          </output>
        </div>
      </form>
    </div>
    <FiledEntries entries={card.filed} nouns={nouns} />
  </div>
);

// The entries filed while the dialog is open, newest first, so the one just
// filed lands right under the card it was written on.
const FiledEntries = ({
  entries,
  nouns,
}: {
  readonly entries: EntryCardState<unknown>['filed'];
  readonly nouns: CourseNouns;
}) => {
  const headingId = useId();
  if (entries.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 className="eyebrow" id={headingId}>
        {countNoun(entries.length, nouns.singular, nouns.plural)} eingetragen
      </h3>
      <ul className={cardListClass}>
        {entries.map((entry) => (
          <li
            className={`${filedRowClass} grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]`}
            key={entry.key}
          >
            <VerdictMark className="size-4 self-center" kind="check" />
            <span
              className="truncate font-display text-lg"
              lang={entry.frontLang}
            >
              {entry.front}
            </span>
            <span className="col-start-2 flex min-w-0 items-baseline gap-2 text-muted-foreground text-sm sm:col-start-3">
              <span className="truncate">{entry.back}</span>
              {entry.note === null ? null : (
                <span className="shrink-0 text-warning-foreground text-xs">
                  {entry.note}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
