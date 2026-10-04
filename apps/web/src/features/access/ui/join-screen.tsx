import { type SubmitEvent, useId, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { fieldClass } from '../../../shared/ui/field-styles';

// Longer input is not a code; the server rejects it as well.
const maximumCodeLength = 100;

type JoinScreenProps = {
  // The code from the link that opened the page, if any.
  readonly initialCode: string;
  readonly register: (code: string) => Promise<void>;
};

export const JoinScreen = ({ initialCode, register }: JoinScreenProps) => {
  const fieldId = useId();
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const trimmed = code.trim();

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (trimmed === '') {
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      await register(trimmed);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-prose text-muted-foreground">
        Mit dem Code aus deiner Einladung speicherst du einen Passkey auf diesem
        Gerät. Danach meldest du dich damit an, ganz ohne Passwort.
      </p>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <label className="flex flex-col gap-1 text-sm" htmlFor={fieldId}>
          Einladungs- oder Wiederherstellungscode
          <input
            autoComplete="off"
            className={fieldClass}
            disabled={busy}
            id={fieldId}
            maxLength={maximumCodeLength}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
            value={code}
          />
        </label>
        <Button
          className="self-start"
          disabled={busy || trimmed === ''}
          type="submit"
        >
          {busy ? 'Warte auf dein Gerät …' : 'Passkey speichern'}
        </Button>
      </form>
      <output className="max-w-prose text-destructive text-sm">
        {failed
          ? 'Das hat nicht geklappt. Versuche es noch einmal. Wenn der Code abgelaufen ist oder schon benutzt wurde, bitte um einen neuen.'
          : null}
      </output>
      <p className="max-w-prose text-muted-foreground text-sm">
        Ein Wiederherstellungscode ersetzt deine bisherigen Passkeys und meldet
        dich auf allen anderen Geräten ab. Deine Sprachen, Fächer und Sammlungen
        bleiben erhalten.
      </p>
    </div>
  );
};
