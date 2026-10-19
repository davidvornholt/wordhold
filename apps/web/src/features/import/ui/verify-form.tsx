import type { GeneratedExample } from '../../../shared/examples/example-draft';
import { countNoun } from '../../../shared/format/count';
import type { BookSelectionData } from '../schemas/import-payload';
import type { Book, Unit, UnitEntry } from '../services/repository';
import { EntryLedger } from './entry-ledger';
import type { DraftEntry } from './entry-row';
import { handleLedgerKeyDown } from './ledger-keyboard';
import { entryRemovalNotice } from './removal-notice';
import { ReviewChecklist } from './review-checklist';
import { useBulkExamples } from './use-bulk-examples';
import { useDraftForm } from './use-draft-form';
import { VerifyActionBar } from './verify-action-bar';
import {
  skippedSummary,
  type VerificationEntry,
} from './verify-form-selection';

type VerifyFormProps = {
  readonly initialEntries: ReadonlyArray<DraftEntry>;
  readonly initialUnitName: string | undefined;
  readonly existingEntries: ReadonlyArray<UnitEntry>;
  readonly targetLabel: string;
  readonly books: ReadonlyArray<Book>;
  readonly units: ReadonlyArray<Unit>;
  readonly busy: boolean;
  readonly generateExample: (
    targetText: string,
    nativeText: string,
  ) => Promise<GeneratedExample>;
  readonly translateExample: (
    targetText: string,
  ) => Promise<{ readonly native: string }>;
  readonly onSubmit: (
    book: BookSelectionData,
    verifiedEntries: ReadonlyArray<VerificationEntry>,
  ) => void;
  readonly submitLabel?: (entryCount: number) => string;
};

const defaultSubmitLabel = (entryCount: number): string =>
  entryCount === 0
    ? 'Seite abschließen'
    : `${countNoun(entryCount, 'Eintrag', 'Einträge')} importieren`;

export const VerifyForm = ({
  initialEntries,
  initialUnitName,
  existingEntries,
  generateExample,
  translateExample,
  targetLabel,
  books,
  units,
  busy,
  onSubmit,
  submitLabel = defaultSubmitLabel,
}: VerifyFormProps) => {
  const form = useDraftForm({
    initialEntries,
    initialUnitName,
    books,
    units,
    existingEntries,
    busy,
  });
  const bulk = useBulkExamples({
    rows: form.rows,
    generate: generateExample,
    onGenerated: form.applyGeneratedExample,
  });
  const { formState } = form;

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Keydown bubbles up from the ledger's fields; the form delegates Enter and Ctrl+Enter for them and is never a keyboard target itself.
    <form
      aria-busy={busy}
      className="flex flex-col gap-4"
      onKeyDown={handleLedgerKeyDown}
      onSubmit={(event) => {
        event.preventDefault();
        if (!formState.submittable) {
          return;
        }
        onSubmit(form.book, formState.entriesToSubmit);
      }}
      ref={form.formRef}
    >
      <ReviewChecklist bulk={bulk} disabled={busy} form={form} />
      <EntryLedger
        books={books}
        busy={busy}
        form={form}
        generateExample={generateExample}
        targetLabel={targetLabel}
        translateExample={translateExample}
      />
      <VerifyActionBar
        busy={busy}
        busyLabel="Importiere …"
        removalNotice={
          form.removal === null ? null : entryRemovalNotice(form.removal)
        }
        status={
          formState.selection.skipped > 0
            ? skippedSummary(formState.selection.skipped)
            : null
        }
        submitLabel={submitLabel(
          formState.completionWithoutImport
            ? 0
            : formState.selection.entries.length,
        )}
        submittable={formState.submittable}
      />
    </form>
  );
};
