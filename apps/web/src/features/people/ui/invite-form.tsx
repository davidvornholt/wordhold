import { type SubmitEvent, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { fieldClass } from '../../../shared/ui/field-styles';
import { maximumPersonNameLength } from '../schemas/people-models';

type InviteFormProps = {
  readonly invite: (name: string) => Promise<void>;
};

export const InviteForm = ({ invite }: InviteFormProps) => {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const trimmed = name.trim();

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (trimmed === '') {
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      await invite(trimmed);
      setName('');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          Name
          <input
            autoComplete="off"
            className={fieldClass}
            disabled={busy}
            maxLength={maximumPersonNameLength}
            onChange={(event) => setName(event.target.value)}
            placeholder="z. B. Anna"
            value={name}
          />
        </label>
        <Button
          className="self-end"
          disabled={busy || trimmed === ''}
          type="submit"
        >
          Einladung erstellen
        </Button>
      </div>
      <output className={failed ? 'text-destructive text-sm' : 'text-sm'}>
        {busy ? 'Einladung wird erstellt …' : null}
        {failed
          ? 'Die Einladung wurde nicht erstellt. Versuche es noch einmal.'
          : null}
      </output>
    </form>
  );
};
