import {
  ArrowDownIcon,
  CopyIcon,
  type LucideIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { type RefObject, useId, useRef } from 'react';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import { focusRing } from '../../../shared/ui/field-styles';
import { isUncertain } from './draft-rows';
import { indexesWhere } from './flag-indexes';
import { type LedgerField, ledgerFieldAttribute } from './ledger-keyboard';
import type { BulkExamples } from './use-bulk-examples';
import type { DraftForm } from './use-draft-form';

type FlagJumpProps = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly formRef: RefObject<HTMLFormElement | null>;
  readonly rows: ReadonlyArray<{ readonly rowId: string }>;
  readonly flagged: ReadonlyArray<number>;
  // The field of a flagged row that needs the learner.
  readonly field: (index: number) => LedgerField;
};

// Each press moves to the next flagged row and puts the cursor in its field,
// starting over after the last, so a long page is checked flag by flag.
export const FlagJump = ({
  icon: Icon,
  label,
  formRef,
  rows,
  flagged,
  field: flaggedField,
}: FlagJumpProps) => {
  const lastJumpRef = useRef(-1);
  const jump = () => {
    const index =
      flagged.find((candidate) => candidate > lastJumpRef.current) ??
      flagged[0];
    const rowId = index === undefined ? undefined : rows[index]?.rowId;
    const field =
      formRef.current?.querySelector<HTMLElement>(
        `[data-row-id="${rowId}"] [${ledgerFieldAttribute}="${index === undefined ? 'target' : flaggedField(index)}"]`,
      ) ?? null;
    if (index === undefined || field === null) {
      return;
    }
    lastJumpRef.current = index;
    field.focus({ preventScroll: true });
    field.scrollIntoView({ block: 'center' });
  };
  return (
    <button
      className={`inline-flex min-h-11 items-center gap-2 border border-warning-foreground/30 bg-warning px-3 text-sm text-warning-foreground shadow-[inset_3px_0_0_var(--color-warning-foreground)] hover:border-warning-foreground/60 ${focusRing}`}
      onClick={jump}
      type="button"
    >
      <Icon aria-hidden={true} className="size-4" />
      <span className="font-medium">{label}</span>
      <span className="sr-only"> – zum nächsten springen</span>
      <ArrowDownIcon aria-hidden={true} className="size-4 opacity-70" />
    </button>
  );
};

const bulkStatus = (bulk: BulkExamples): string => {
  if (bulk.progress !== null) {
    return `Beispielsätze werden erzeugt … ${bulk.progress.done} von ${bulk.progress.total}`;
  }
  return bulk.generated === 0
    ? ''
    : `${countNoun(bulk.generated, 'Beispielsatz', 'Beispielsätze')} erzeugt.`;
};

// The status line stays in place from the click to the result, so focus
// moves there when the button goes away during the run.
const BulkExamplesItem = ({
  bulk,
  disabled,
}: {
  readonly bulk: BulkExamples;
  readonly disabled: boolean;
}) => {
  const statusRef = useRef<HTMLParagraphElement>(null);
  const status = bulkStatus(bulk);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <p
        aria-live="polite"
        className={`text-muted-foreground outline-none ${status === '' ? 'sr-only' : ''}`}
        ref={statusRef}
        tabIndex={-1}
      >
        {status}
      </p>
      {bulk.progress !== null || bulk.missing === 0 ? null : (
        <>
          <span className="text-muted-foreground">
            {countNoun(bulk.missing, 'Eintrag', 'Einträge')} ohne Beispielsatz
          </span>
          <Button
            className="px-3"
            disabled={disabled}
            onClick={() => {
              statusRef.current?.focus();
              bulk.generateAll();
            }}
            variant="outline"
          >
            <SparklesIcon aria-hidden={true} className="size-4" />
            Beispielsätze erzeugen
          </Button>
        </>
      )}
      {bulk.failed === 0 ? null : (
        <p className="text-destructive" role="alert">
          {countNoun(bulk.failed, 'Satz konnte', 'Sätze konnten')} nicht erzeugt
          werden. Versuche es noch einmal oder erzeuge sie einzeln.
        </p>
      )}
    </div>
  );
};

type ReviewChecklistProps = {
  readonly form: DraftForm;
  readonly bulk: BulkExamples;
  readonly disabled: boolean;
};

// What still needs a look before the import, each with a way to get to it.
// Nothing is listed for a page that was read cleanly.
export const ReviewChecklist = ({
  form,
  bulk,
  disabled,
}: ReviewChecklistProps) => {
  const headingId = useId();
  const { rows, formState } = form;
  const uncertain = indexesWhere(rows, isUncertain);
  const duplicates = indexesWhere(
    rows,
    (_row, index) =>
      (formState.duplicates[index]?.verdict ?? 'none') !== 'none',
  );
  const bulkActive =
    bulk.missing > 0 ||
    bulk.progress !== null ||
    bulk.failed > 0 ||
    bulk.generated > 0;
  if (uncertain.length === 0 && duplicates.length === 0 && !bulkActive) {
    return null;
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 className="eyebrow" id={headingId}>
        Vor dem Import
      </h2>
      {uncertain.length === 0 && duplicates.length === 0 ? null : (
        <ul className="flex flex-wrap gap-2">
          {uncertain.length === 0 ? null : (
            <li>
              <FlagJump
                field={() => 'target'}
                flagged={uncertain}
                formRef={form.formRef}
                icon={TriangleAlertIcon}
                label={`${uncertain.length} unsicher gelesen`}
                rows={rows}
              />
            </li>
          )}
          {duplicates.length === 0 ? null : (
            <li>
              <FlagJump
                field={() => 'target'}
                flagged={duplicates}
                formRef={form.formRef}
                icon={CopyIcon}
                label={`${duplicates.length} schon vorhanden`}
                rows={rows}
              />
            </li>
          )}
        </ul>
      )}
      {bulkActive ? <BulkExamplesItem bulk={bulk} disabled={disabled} /> : null}
    </section>
  );
};
