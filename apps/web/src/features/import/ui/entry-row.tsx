import { BetweenHorizontalStartIcon, XIcon } from 'lucide-react';
import type {
  ExampleDraft,
  ExampleGenerationSource,
  GeneratedExample,
} from '../../../shared/examples/example-draft';
import { Button } from '../../../shared/ui/button';
import { useExampleDraft } from '../../../shared/ui/use-example-draft';
import type { DraftDuplicate } from './draft-duplicates';
import { isUncertain } from './draft-rows';
import { NativeColumn, TermColumn } from './entry-row-columns';
import { ledgerGrid } from './ledger-grid';
import { RowFlags } from './row-flags';

export type DraftEntry = ExampleDraft & {
  readonly confidence?: number;
  // Comma-separated, as typed or as read from the page.
  readonly synonyms?: string;
  readonly antonyms?: string;
};

type EntryRowProps = {
  readonly entry: DraftEntry;
  readonly rowId: string;
  readonly entryNumber: number;
  // Added by hand on this screen rather than read from the page.
  readonly added: boolean;
  readonly disabled: boolean;
  readonly targetLabel: string;
  readonly generateExample: (
    targetText: string,
    nativeText: string,
  ) => Promise<GeneratedExample>;
  readonly translateExample: (
    targetText: string,
  ) => Promise<{ readonly native: string }>;
  readonly duplicate: DraftDuplicate;
  readonly duplicateConfirmed: boolean;
  readonly onChange: (entry: DraftEntry) => void;
  readonly onTranslatedExample: (sentence: string, native: string) => void;
  readonly onGeneratedExample: (
    source: ExampleGenerationSource,
    generated: GeneratedExample,
  ) => void;
  readonly onDuplicateConfirmedChange: (confirmed: boolean) => void;
  readonly onRemove: () => void;
  // Null on a row that already starts a unit.
  readonly onStartUnit: (() => void) | null;
};

// One line of the ledger: the word and its example sentence in the left
// column, their German in the right, as a vocabulary notebook is kept.
// Rows the reading was unsure about carry a warning edge.
export const EntryRow = ({
  entry,
  rowId,
  entryNumber,
  added,
  disabled,
  targetLabel,
  generateExample,
  translateExample,
  duplicate,
  duplicateConfirmed,
  onChange,
  onGeneratedExample,
  onTranslatedExample,
  onDuplicateConfirmedChange,
  onRemove,
  onStartUnit,
}: EntryRowProps) => {
  const example = useExampleDraft({
    disabled,
    entry,
    generate: generateExample,
    translate: translateExample,
    onChange,
    onGenerated: onGeneratedExample,
    onTranslated: onTranslatedExample,
  });
  const uncertain = isUncertain(entry);
  const flagged = uncertain || duplicate.verdict !== 'none';
  const tone = flagged
    ? 'bg-warning/40 shadow-[inset_4px_0_0_var(--color-warning-foreground)]'
    : 'focus-within:bg-accent/20';

  return (
    <li
      className={`${ledgerGrid} border-border border-b transition-colors ${tone} ${added ? 'animate-rise' : ''}`}
      data-row-id={rowId}
    >
      <span className="pt-3.5 pr-2 text-right font-display text-muted-foreground tabular-nums">
        <span className="sr-only">Eintrag </span>
        {entryNumber}
      </span>
      <TermColumn
        disabled={disabled}
        entry={entry}
        example={example}
        onChange={onChange}
        targetLabel={targetLabel}
      />
      <NativeColumn
        disabled={disabled}
        entry={entry}
        example={example}
        onChange={onChange}
      />
      <div className="col-start-3 row-start-1 flex items-start justify-end sm:col-start-4">
        {onStartUnit === null ? null : (
          <Button
            aria-label={`Andere Einheit ab Eintrag ${entryNumber}`}
            data-row-split={true}
            disabled={disabled}
            onClick={onStartUnit}
            title="Andere Einheit ab hier"
            variant="icon"
          >
            <BetweenHorizontalStartIcon aria-hidden={true} className="size-4" />
          </Button>
        )}
        <Button
          aria-label={`Eintrag ${entryNumber} entfernen`}
          data-row-remove={true}
          disabled={disabled}
          onClick={onRemove}
          title="Eintrag entfernen"
          variant="icon"
        >
          <XIcon aria-hidden={true} className="size-4" />
        </Button>
      </div>
      {flagged ? (
        <RowFlags
          disabled={disabled}
          duplicate={duplicate}
          duplicateConfirmed={duplicateConfirmed}
          onDuplicateConfirmedChange={onDuplicateConfirmedChange}
          uncertain={uncertain}
        />
      ) : null}
    </li>
  );
};
