import { CopyIcon, TriangleAlertIcon } from 'lucide-react';
import { useId } from 'react';
import { Checkbox } from '../../../shared/ui/selection-controls';
import type { DraftDuplicate } from './draft-duplicates';

type DuplicateNoteProps = {
  readonly duplicate: Exclude<DraftDuplicate, { readonly verdict: 'none' }>;
  readonly confirmed: boolean;
  readonly disabled: boolean;
  readonly onConfirmedChange: (confirmed: boolean) => void;
};

const DuplicateNote = ({
  duplicate,
  confirmed,
  disabled,
  onConfirmedChange,
}: DuplicateNoteProps) => {
  const confirmationId = useId();
  return (
    <div className="flex items-start gap-2">
      <CopyIcon aria-hidden={true} className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1">
        <p>
          <span className="font-medium">
            {duplicate.location === null
              ? 'Schon auf dieser Seite.'
              : `Schon in ${duplicate.location}.`}
          </span>
          {duplicate.verdict === 'exact'
            ? ' Wird nicht erneut importiert. Für eine Ausnahme ändere die Schreibweise oder den Beispielsatz.'
            : null}
        </p>
        {duplicate.verdict === 'exception' ? (
          <label className="flex items-center gap-2" htmlFor={confirmationId}>
            <Checkbox
              checked={confirmed}
              disabled={disabled}
              id={confirmationId}
              onChange={(event) => onConfirmedChange(event.target.checked)}
            />
            Als Ausnahme importieren (andere Schreibweise oder anderes Beispiel)
          </label>
        ) : null}
      </div>
    </div>
  );
};

type RowFlagsProps = {
  readonly uncertain: boolean;
  readonly duplicate: DraftDuplicate;
  readonly duplicateConfirmed: boolean;
  readonly disabled: boolean;
  readonly onDuplicateConfirmedChange: (confirmed: boolean) => void;
};

// What the reading could not settle on its own, written under the row it
// concerns.
export const RowFlags = ({
  uncertain,
  duplicate,
  duplicateConfirmed,
  disabled,
  onDuplicateConfirmedChange,
}: RowFlagsProps) => (
  <div className="col-[2/-1] flex flex-col gap-2 pb-3 text-sm text-warning-foreground">
    {uncertain ? (
      <p className="flex items-start gap-2">
        <TriangleAlertIcon
          aria-hidden={true}
          className="mt-0.5 size-4 shrink-0"
        />
        <span>
          <span className="font-medium">Unsicher gelesen.</span> Vergleiche den
          Eintrag mit dem Foto.
        </span>
      </p>
    ) : null}
    {duplicate.verdict === 'none' ? null : (
      <DuplicateNote
        confirmed={duplicateConfirmed}
        disabled={disabled}
        duplicate={duplicate}
        onConfirmedChange={onDuplicateConfirmedChange}
      />
    )}
  </div>
);
