import { useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { fieldClass } from '../../../shared/ui/field-styles';
import { useNameDraft } from './use-name-draft';

type NameFormProps = {
  readonly label: string;
  readonly placeholder: string;
  readonly submitLabel: string;
  readonly statusLabel: string;
  readonly maxLength: number;
  readonly initialName: string;
  // The message to show instead of saving, or null when the name is free.
  readonly conflict: (name: string) => string | null;
  readonly save: (name: string) => Promise<void>;
  readonly pendingStatus: string;
  readonly savedStatus: (name: string) => string;
  readonly failedStatus: string;
};

// A settings page's one text field for a new name. The saved name stays in
// the field.
export const NameForm = ({
  label,
  placeholder,
  submitLabel,
  statusLabel,
  maxLength,
  initialName,
  conflict,
  save,
  pendingStatus,
  savedStatus,
  failedStatus,
}: NameFormProps) => {
  const [saved, setSaved] = useState<string | null>(null);
  const { name, setName, busy, error, submittable, submit } = useNameDraft({
    initialName,
    conflict,
    save,
    failedMessage: failedStatus,
    onSaved: setSaved,
  });
  let status = saved === null ? '' : savedStatus(saved);
  if (busy) {
    status = pendingStatus;
  } else if (error !== null) {
    status = error;
  }

  return (
    <>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          {label}
          <input
            className={fieldClass}
            disabled={busy}
            maxLength={maxLength}
            onChange={(event) => setName(event.target.value)}
            placeholder={placeholder}
            value={name}
          />
        </label>
        <Button
          className="self-end"
          disabled={!submittable}
          type="submit"
          variant="outline"
        >
          {submitLabel}
        </Button>
      </form>
      <output
        aria-label={statusLabel}
        className={
          !busy && error !== null ? 'text-destructive text-sm' : 'text-sm'
        }
      >
        {status}
      </output>
    </>
  );
};
