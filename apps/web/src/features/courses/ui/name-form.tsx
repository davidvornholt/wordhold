import { type SubmitEvent, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { fieldClass } from '../../../shared/ui/field-styles';

type NameFormProps = {
  readonly label: string;
  readonly placeholder: string;
  readonly submitLabel: string;
  readonly statusLabel: string;
  readonly maxLength: number;
  readonly initialName?: string;
  readonly busy: boolean;
  // The message to show instead of saving, or null when the name is free.
  readonly conflict: (name: string) => string | null;
  readonly save: (name: string) => Promise<void>;
  readonly pendingStatus: string;
  readonly savedStatus: (name: string) => string;
  readonly failedStatus: string;
  readonly onBusyChange: (busy: boolean) => void;
};

// One text field that saves a name: a new unit, a new book, or a book's new
// name. The field is cleared after adding and kept after renaming.
export const NameForm = ({
  label,
  placeholder,
  submitLabel,
  statusLabel,
  maxLength,
  initialName,
  busy,
  conflict,
  save,
  pendingStatus,
  savedStatus,
  failedStatus,
  onBusyChange,
}: NameFormProps) => {
  const [name, setName] = useState(initialName ?? '');
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('');
  const trimmed = name.trim();
  const unchanged = initialName !== undefined && trimmed === initialName;

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || trimmed === '' || unchanged) {
      return;
    }
    const conflictMessage = conflict(trimmed);
    if (conflictMessage !== null) {
      setFailed(true);
      setStatus(conflictMessage);
      return;
    }
    onBusyChange(true);
    setFailed(false);
    setStatus(pendingStatus);
    try {
      await save(trimmed);
      setName(initialName === undefined ? '' : trimmed);
      setStatus(savedStatus(trimmed));
    } catch {
      setFailed(true);
      setStatus(failedStatus);
    } finally {
      onBusyChange(false);
    }
  };

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
          disabled={busy || trimmed === '' || unchanged}
          type="submit"
          variant="outline"
        >
          {submitLabel}
        </Button>
      </form>
      <output
        aria-label={statusLabel}
        className={failed ? 'text-destructive text-sm' : 'text-sm'}
      >
        {status}
      </output>
    </>
  );
};
