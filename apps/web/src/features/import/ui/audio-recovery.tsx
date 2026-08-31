import { useEffect, useEffectEvent } from 'react';
import { countNoun } from '../../../shared/format/count';
import { Callout } from '../../../shared/ui/callout';

type AudioRecoveryProps = {
  readonly imported: number | null;
  readonly busy: boolean;
  readonly onRetry: () => void;
};

export const AudioRecovery = ({
  imported,
  busy,
  onRetry,
}: AudioRecoveryProps) => {
  const retry = useEffectEvent(onRetry);
  useEffect(() => {
    retry();
  }, []);

  return (
    <Callout aria-busy={busy} aria-live="polite" tone="neutral">
      <h2 className="font-display text-xl">Import abgeschlossen</h2>
      <p className="text-sm">
        {imported === null
          ? 'Die Einträge wurden bereits importiert.'
          : `${countNoun(imported, 'Eintrag wurde', 'Einträge wurden')} importiert.`}{' '}
        Wordhold ergänzt die Aussprache automatisch. Du kannst bereits
        weiterlernen.
      </p>
    </Callout>
  );
};
