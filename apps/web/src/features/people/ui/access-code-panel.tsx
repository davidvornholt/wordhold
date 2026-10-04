import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { Callout } from '../../../shared/ui/callout';
import { fieldOnCardClass } from '../../../shared/ui/field-styles';
import { codeExpiry } from '../schemas/people-labels';
import type { IssuedCode } from '../schemas/people-models';

type AccessCodePanelProps = {
  readonly issued: IssuedCode;
  // The page a person opens to save a passkey with this code.
  readonly link: string;
  readonly onHide: () => void;
};

type CopyState = 'idle' | 'copied' | 'failed';

// Shown once, right after the code was created: only its digest is stored,
// so the link cannot be displayed again later.
export const AccessCodePanel = ({
  issued,
  link,
  onHide,
}: AccessCodePanelProps) => {
  const fieldId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copy, setCopy] = useState<CopyState>('idle');
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const recovery = issued.kind === 'recovery';

  return (
    <section aria-labelledby={`${fieldId}-heading`}>
      <Callout tone="positive">
        <h2
          className="font-display text-xl"
          id={`${fieldId}-heading`}
          ref={headingRef}
          tabIndex={-1}
        >
          {recovery ? 'Wiederherstellungscode' : 'Einladung'} für {issued.name}
        </h2>
        <p className="max-w-prose text-sm">
          Schick {issued.name} diesen Link direkt, zum Beispiel per Nachricht.
          Er funktioniert einmal und bis {codeExpiry(issued.expiresAt)}. Wer ihn
          öffnet, speichert einen Passkey auf dem eigenen Gerät.
          {recovery
            ? ` Der neue Passkey ersetzt alle bisherigen, und ${issued.name} wird auf allen Geräten abgemeldet.`
            : ''}
        </p>
        <label className="flex flex-col gap-1 text-sm" htmlFor={fieldId}>
          Link zum Einrichten
          <input
            className={fieldOnCardClass}
            id={fieldId}
            onFocus={(event) => event.target.select()}
            readOnly={true}
            value={link}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopy('copied');
              } catch {
                setCopy('failed');
              }
            }}
          >
            Link kopieren
          </Button>
          <Button onClick={onHide} variant="quiet">
            Ausblenden
          </Button>
        </div>
        <output className="text-sm">
          {copy === 'copied' ? 'Link kopiert.' : null}
          {copy === 'failed'
            ? 'Kopieren hat nicht geklappt. Markiere den Link im Feld und kopiere ihn selbst.'
            : null}
        </output>
      </Callout>
    </section>
  );
};
