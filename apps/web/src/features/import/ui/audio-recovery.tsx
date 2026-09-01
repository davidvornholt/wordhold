import { useEffect, useEffectEvent } from 'react';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import { Callout } from '../../../shared/ui/callout';

type AudioRecoveryProps = {
  readonly imported: number | null;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
};

export const AudioRecovery = ({
  imported,
  busy,
  error,
  onRetry,
}: AudioRecoveryProps) => {
  const retry = useEffectEvent(onRetry);
  useEffect(() => {
    retry();
  }, []);

  return (
    <Callout aria-busy={busy} tone={error === null ? 'neutral' : 'destructive'}>
      <h2 className="font-display text-xl">Import abgeschlossen</h2>
      <p className="text-sm">
        {imported === null
          ? 'Die Einträge wurden bereits importiert.'
          : `${countNoun(imported, 'Eintrag wurde', 'Einträge wurden')} importiert.`}{' '}
        Wordhold ergänzt die Aussprache automatisch. Du kannst bereits
        weiterlernen.
      </p>
      {busy || error !== null ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm" role={busy ? 'status' : 'alert'}>
            {busy
              ? 'Aussprache wird erstellt …'
              : 'Die Aussprache konnte noch nicht erstellt werden.'}
          </p>
          <Button
            aria-disabled={busy}
            onClick={() => {
              if (!busy) {
                onRetry();
              }
            }}
          >
            {busy ? 'Wird erstellt …' : 'Erneut versuchen'}
          </Button>
        </div>
      ) : null}
    </Callout>
  );
};
