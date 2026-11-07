import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { Callout } from '../../../shared/ui/callout';
import { fieldClass } from '../../../shared/ui/field-styles';

export type DeviceStatus = 'pending' | 'approved' | 'denied';
export type DeviceDecision = 'approve' | 'deny';

type DeviceScreenProps = {
  /** The code from the link the CLI printed, or empty when typed by hand. */
  readonly initialCode: string;
  /** Looks the code up; this also ties it to the signed-in person. */
  readonly check: (code: string) => Promise<DeviceStatus>;
  readonly decide: (code: string, decision: DeviceDecision) => Promise<void>;
};

type View =
  | 'checking'
  | 'unknown'
  | DeviceStatus
  | 'deciding'
  | 'decision-failed';

const CodeForm = ({ onCode }: { readonly onCode: (code: string) => void }) => {
  const [typed, setTyped] = useState('');
  const fieldId = useId();
  const code = typed.trim().toUpperCase();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onCode(code);
      }}
    >
      <label className="flex flex-col gap-1 text-sm" htmlFor={fieldId}>
        Code aus dem Terminal
        <input
          autoComplete="off"
          className={`${fieldClass} max-w-xs font-mono uppercase tracking-widest`}
          id={fieldId}
          onChange={(event) => setTyped(event.target.value)}
          spellCheck={false}
          value={typed}
        />
      </label>
      <Button className="self-start" disabled={code === ''} type="submit">
        Weiter
      </Button>
    </form>
  );
};

const terminalHint = (
  <>
    Starte <code>wordhold login</code> noch einmal und öffne den neuen Link.
  </>
);

/**
 * Approves a `wordhold login` from a terminal. Approving gives the command a
 * session of its own, which `wordhold logout` ends.
 */
export const DeviceScreen = ({
  initialCode,
  check,
  decide,
}: DeviceScreenProps) => {
  const [code, setCode] = useState(initialCode);
  const [view, setView] = useState<View>('checking');
  // Each lookup counts against a small rate limit, so a code is looked up
  // once even when React runs the effect twice.
  const lookupsRef = useRef(new Map<string, Promise<DeviceStatus>>());

  useEffect(() => {
    if (code === '') {
      return;
    }
    let current = true;
    setView('checking');
    const known = lookupsRef.current.get(code);
    const lookup = known ?? check(code);
    lookupsRef.current.set(code, lookup);
    lookup.then(
      (status) => {
        if (current) {
          setView(status);
        }
      },
      () => {
        if (current) {
          setView('unknown');
        }
      },
    );
    return () => {
      current = false;
    };
  }, [code, check]);

  const choose = async (decision: DeviceDecision) => {
    setView('deciding');
    try {
      await decide(code, decision);
      setView(decision === 'approve' ? 'approved' : 'denied');
    } catch {
      setView('decision-failed');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose text-muted-foreground">
        Mit dem Befehl <code>wordhold</code> kann ein KI-Agent auf deinem
        Computer deinen Wortschatz lesen und in deinem Namen Wörter hinzufügen
        oder ändern. Bestätige nur eine Anmeldung, die du gerade selbst mit{' '}
        <code>wordhold login</code> gestartet hast, und prüfe, dass der Code
        derselbe ist wie im Terminal.
      </p>
      {code === '' ? <CodeForm onCode={setCode} /> : null}
      {code !== '' && view !== 'unknown' ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-xl">Code</h2>
          <p className="font-mono text-3xl tracking-widest">{code}</p>
          {view === 'pending' ||
          view === 'deciding' ||
          view === 'decision-failed' ? (
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={view === 'deciding'}
                onClick={() => choose('approve')}
              >
                Anmeldung bestätigen
              </Button>
              <Button
                disabled={view === 'deciding'}
                onClick={() => choose('deny')}
                variant="quiet"
              >
                Ablehnen
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
      <output className="max-w-prose">
        {view === 'checking' && code !== '' ? 'Der Code wird geprüft …' : null}
        {view === 'approved'
          ? 'Der Befehl ist angemeldet. Du kannst diesen Tab schließen und zum Terminal zurückkehren.'
          : null}
        {view === 'denied'
          ? 'Du hast die Anmeldung abgelehnt. Der Befehl bleibt abgemeldet.'
          : null}
      </output>
      {view === 'unknown' ? (
        <Callout tone="destructive">
          <p>
            Diesen Code gibt es nicht oder er ist abgelaufen. {terminalHint}
          </p>
        </Callout>
      ) : null}
      {view === 'decision-failed' ? (
        <Callout role="alert" tone="destructive">
          <p>Das hat nicht geklappt. {terminalHint}</p>
        </Callout>
      ) : null}
    </div>
  );
};
