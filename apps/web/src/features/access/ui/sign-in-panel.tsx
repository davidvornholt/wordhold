import { type ReactNode, useState } from 'react';
import { Button } from '../../../shared/ui/button';

type SignInPanelProps = {
  readonly signInWithPasskey: () => Promise<void>;
  readonly signInWithGithub: () => Promise<void>;
  // Where someone with an invitation or recovery link sets up a passkey.
  readonly joinLink: ReactNode;
};

type Pending = 'passkey' | 'github' | null;

// Family members sign in with a passkey; GitHub is kept for the
// administrator and folded away.
export const SignInPanel = ({
  signInWithPasskey,
  signInWithGithub,
  joinLink,
}: SignInPanelProps) => {
  const [pending, setPending] = useState<Pending>(null);
  const [failed, setFailed] = useState(false);

  const run = async (
    method: Exclude<Pending, null>,
    signIn: () => Promise<void>,
  ) => {
    setPending(method);
    setFailed(false);
    try {
      await signIn();
    } catch {
      setFailed(true);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col items-start gap-4">
      <Button
        disabled={pending !== null}
        onClick={() => run('passkey', signInWithPasskey)}
      >
        {pending === 'passkey'
          ? 'Warte auf deinen Passkey …'
          : 'Mit Passkey anmelden'}
      </Button>
      <output className="max-w-prose text-destructive text-sm">
        {failed
          ? 'Die Anmeldung hat nicht geklappt. Versuche es noch einmal, nimm einen Passkey von einem anderen Gerät oder bitte um einen Wiederherstellungscode.'
          : null}
      </output>
      <p className="max-w-prose text-muted-foreground text-sm">
        Auf einem fremden Gerät? Wähle in der Passkey-Abfrage „Anderes Gerät
        verwenden“ und scanne den QR-Code mit deinem Handy.
      </p>
      {joinLink}
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-3 text-muted-foreground">
          Anmeldung für den Administrator
        </summary>
        <Button
          disabled={pending !== null}
          onClick={() => run('github', signInWithGithub)}
          variant="outline"
        >
          {pending === 'github' ? 'Weiter zu GitHub …' : 'Mit GitHub anmelden'}
        </Button>
      </details>
    </div>
  );
};
