import { handleLedgerKeyDown } from './ledger-keyboard';
import { termRemovalNotice } from './removal-notice';
import type { TermDraft } from './term-draft-rows';
import { TermLedger } from './term-ledger';
import { TermReviewChecklist } from './term-review-checklist';
import { useTermReview } from './use-term-review';
import { VerifyActionBar } from './verify-action-bar';

type TermReviewFormProps = {
  readonly initialTerms: ReadonlyArray<TermDraft>;
  readonly existingTerms: ReadonlyArray<string>;
  readonly busy: boolean;
  readonly submitLabel: (termCount: number) => string;
  readonly onSubmit: (
    terms: ReadonlyArray<{
      readonly term: string;
      readonly definition: string;
    }>,
  ) => void;
};

const skippedStatus = (skipped: number): string | null => {
  if (skipped === 0) {
    return null;
  }
  return skipped === 1
    ? '1 Begriff ist schon eingetragen und wird übersprungen.'
    : `${skipped} Begriffe sind schon eingetragen und werden übersprungen.`;
};

const incompleteStatus = (incomplete: number): string | null => {
  if (incomplete === 0) {
    return null;
  }
  return incomplete === 1
    ? 'Ergänze oder entferne die unvollständige Zeile.'
    : `Ergänze oder entferne die ${incomplete} unvollständigen Zeilen.`;
};

// What the save leaves out and what still holds it back.
const reviewStatus = (skipped: number, incomplete: number): string | null => {
  const parts = [skippedStatus(skipped), incompleteStatus(incomplete)].filter(
    (part) => part !== null,
  );
  return parts.length === 0 ? null : parts.join(' ');
};

export const TermReviewForm = ({
  initialTerms,
  existingTerms,
  busy,
  submitLabel,
  onSubmit,
}: TermReviewFormProps) => {
  const form = useTermReview(initialTerms, existingTerms);
  const { review, removal } = form;
  const submittable = !busy && review.incomplete.length === 0;

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Keydown bubbles up from the ledger's fields; the form delegates Enter and Ctrl+Enter for them and is never a keyboard target itself.
    <form
      aria-busy={busy}
      className="flex flex-col gap-4"
      onKeyDown={handleLedgerKeyDown}
      onSubmit={(event) => {
        event.preventDefault();
        if (submittable) {
          onSubmit(review.terms);
        }
      }}
      ref={form.formRef}
    >
      <TermReviewChecklist form={form} />
      <TermLedger busy={busy} form={form} />
      <VerifyActionBar
        busy={busy}
        busyLabel="Trage ein …"
        removalNotice={removal === null ? null : termRemovalNotice(removal)}
        status={reviewStatus(review.skipped, review.incomplete.length)}
        submitLabel={submitLabel(review.terms.length)}
        submittable={submittable}
      />
    </form>
  );
};
