import { useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { cardListClass } from '../../../shared/ui/surface-styles';
import { type OwnPasskey, passkeyStorage } from '../schemas/passkey-models';

type PasskeysScreenProps = {
  readonly passkeys: ReadonlyArray<OwnPasskey>;
  readonly add: () => Promise<void>;
};

type Status = 'idle' | 'busy' | 'added' | 'failed';

export const PasskeysScreen = ({ passkeys, add }: PasskeysScreenProps) => {
  const [status, setStatus] = useState<Status>('idle');

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose text-muted-foreground">
        Speichere einen weiteren Passkey auf einem anderen Gerät, das dir
        gehört, damit du dich auch ohne dein Handy anmelden kannst. Dein Gerät
        oder dein Passwortmanager entscheidet, wo er gespeichert wird.
      </p>
      <div className="flex flex-col items-start gap-2">
        <Button
          disabled={status === 'busy'}
          onClick={async () => {
            setStatus('busy');
            try {
              await add();
              setStatus('added');
            } catch {
              setStatus('failed');
            }
          }}
        >
          {status === 'busy' ? 'Warte auf dein Gerät …' : 'Passkey hinzufügen'}
        </Button>
        <output
          className={
            status === 'failed'
              ? 'max-w-prose text-destructive text-sm'
              : 'text-sm'
          }
        >
          {status === 'added' ? 'Passkey hinzugefügt.' : null}
          {status === 'failed'
            ? 'Der Passkey wurde nicht hinzugefügt. Melde dich ab und wieder an und versuche es innerhalb von zehn Minuten noch einmal.'
            : null}
        </output>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl">Deine Passkeys</h2>
        <ul className={cardListClass}>
          {passkeys.map((passkey) => (
            <li className="flex flex-col gap-1 px-4 py-3" key={passkey.id}>
              <span>{passkey.name ?? 'Passkey'}</span>
              <span className="text-muted-foreground text-sm">
                {passkeyStorage(passkey)}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <p className="max-w-prose text-muted-foreground text-sm">
        Gerät verloren oder alle Passkeys weg? Bitte um einen
        Wiederherstellungscode. Er ersetzt deine alten Passkeys.
      </p>
    </div>
  );
};
