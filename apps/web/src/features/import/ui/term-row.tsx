import { maximumEntryTextLength } from '@wordhold/ai/extraction/schema';
import { CopyIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { Button } from '../../../shared/ui/button';
import { ledgerFieldClass } from '../../../shared/ui/field-styles';
import { isUncertain } from './draft-rows';
import { termLedgerGrid } from './ledger-grid';
import { ledgerField } from './ledger-keyboard';
import type { TermDraft, TermRepeat, TermRow } from './term-draft-rows';

const repeatNote = (
  repeat: Exclude<TermRepeat, { readonly verdict: 'none' }>,
) => {
  if (repeat.verdict === 'exact') {
    return (
      <>
        <span className="font-medium">
          {repeat.onPage
            ? 'Schon weiter oben auf dieser Seite.'
            : 'Schon im Fach.'}
        </span>{' '}
        Wird nicht noch einmal eingetragen.
      </>
    );
  }
  return (
    <>
      <span className="font-medium">
        {repeat.onPage
          ? `Weiter oben steht „${repeat.term}“.`
          : `Im Fach steht schon „${repeat.term}“.`}
      </span>{' '}
      Wegen der anderen Schreibweise wird der Begriff zusätzlich eingetragen.
    </>
  );
};

type TermRowFlagsProps = {
  readonly uncertain: boolean;
  readonly repeat: TermRepeat;
};

// What the reading could not settle on its own, written under the row it
// concerns.
const TermRowFlags = ({ uncertain, repeat }: TermRowFlagsProps) => (
  <div className="col-[2/-1] flex flex-col gap-2 pb-3 text-sm text-warning-foreground">
    {uncertain ? (
      <p className="flex items-start gap-2">
        <TriangleAlertIcon
          aria-hidden={true}
          className="mt-0.5 size-4 shrink-0"
        />
        <span>
          <span className="font-medium">Unsicher gelesen.</span> Vergleiche den
          Begriff mit dem Foto.
        </span>
      </p>
    ) : null}
    {repeat.verdict === 'none' ? null : (
      <p className="flex items-start gap-2">
        <CopyIcon aria-hidden={true} className="mt-0.5 size-4 shrink-0" />
        <span>{repeatNote(repeat)}</span>
      </p>
    )}
  </div>
);

type TermRowProps = {
  readonly row: TermRow;
  readonly termNumber: number;
  // Added by hand on this screen rather than read from the photo.
  readonly added: boolean;
  readonly disabled: boolean;
  readonly repeat: TermRepeat;
  readonly incomplete: boolean;
  readonly onChange: (
    change: Partial<Pick<TermDraft, 'term' | 'definition'>>,
  ) => void;
  readonly onRemove: () => void;
};

// One line of the notes: the term on the left, its definition on the right,
// where it can wrap over several lines. Rows the reading was unsure about,
// or that the subject already has, carry a warning edge.
export const TermLedgerRow = ({
  row,
  termNumber,
  added,
  disabled,
  repeat,
  incomplete,
  onChange,
  onRemove,
}: TermRowProps) => {
  const uncertain = isUncertain(row);
  const flagged = uncertain || repeat.verdict !== 'none';
  const tone = flagged
    ? 'bg-warning/40 shadow-[inset_4px_0_0_var(--color-warning-foreground)]'
    : 'focus-within:bg-accent/20';
  const termMissing = incomplete && row.term.trim() === '';
  const definitionMissing = incomplete && row.definition.trim() === '';

  return (
    <li
      className={`${termLedgerGrid} group border-border border-b transition-colors ${tone} ${added ? 'animate-rise' : ''}`}
      data-row-id={row.rowId}
    >
      <span className="pt-3.5 pr-2 text-right font-display text-muted-foreground tabular-nums">
        <span className="sr-only">Begriff </span>
        {termNumber}
      </span>
      <div className="col-start-2 row-start-1 flex min-w-0 flex-col pt-1 pb-2 sm:pr-4">
        <input
          {...ledgerField('target')}
          aria-invalid={termMissing}
          aria-label="Begriff"
          className={`${ledgerFieldClass} font-medium`}
          disabled={disabled}
          maxLength={maximumEntryTextLength}
          onChange={(event) => onChange({ term: event.target.value })}
          placeholder="Begriff"
          value={row.term}
        />
      </div>
      <div className="col-start-2 row-start-2 flex min-w-0 flex-col pb-2 sm:col-start-3 sm:row-start-1 sm:border-primary/30 sm:border-l sm:pt-1 sm:pl-4">
        <textarea
          {...ledgerField('native')}
          aria-invalid={definitionMissing}
          aria-label="Erklärung"
          className={`${ledgerFieldClass} field-sizing-content resize-none`}
          disabled={disabled}
          maxLength={maximumEntryTextLength}
          onChange={(event) => onChange({ definition: event.target.value })}
          placeholder="Erklärung"
          rows={1}
          value={row.definition}
        />
      </div>
      <div className="col-start-3 row-start-1 flex items-start justify-end sm:col-start-4">
        <Button
          aria-label={`Begriff ${termNumber} entfernen`}
          data-row-remove={true}
          disabled={disabled}
          onClick={onRemove}
          title="Begriff entfernen"
          variant="icon"
        >
          <XIcon aria-hidden={true} className="size-4" />
        </Button>
      </div>
      {flagged ? <TermRowFlags repeat={repeat} uncertain={uncertain} /> : null}
      {/* Shown once the learner has left the row, not while they are still
          filling it in. */}
      {incomplete ? (
        <p className="col-[2/-1] pb-3 text-muted-foreground text-sm group-focus-within:hidden">
          {termMissing
            ? 'Der Begriff fehlt. Ergänze ihn oder entferne die Zeile.'
            : 'Die Erklärung fehlt. Ergänze sie oder entferne die Zeile.'}
        </p>
      ) : null}
    </li>
  );
};
