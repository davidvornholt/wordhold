import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import { Callout } from '../../../shared/ui/callout';

type AudioRecoveryProps = {
  readonly imported: number | null;
  readonly pending: number | null;
  readonly busy: boolean;
  readonly onRetry: () => void;
};

const pendingCopy = (pending: number | null): string => {
  if (pending === null) {
    return 'Fehlende Audiodateien können erneut erstellt werden.';
  }
  return `${countNoun(pending, 'Audiodatei fehlt', 'Audiodateien fehlen')} noch.`;
};

export const AudioRecovery = ({
  imported,
  pending,
  busy,
  onRetry,
}: AudioRecoveryProps) => (
  <Callout aria-busy={busy} aria-live="polite" tone="warning">
    <h2 className="font-display text-xl">Import abgeschlossen</h2>
    <p className="text-sm">
      {imported === null
        ? 'Die Einträge wurden bereits importiert.'
        : `${countNoun(imported, 'Eintrag wurde', 'Einträge wurden')} importiert.`}{' '}
      {pendingCopy(pending)}
    </p>
    <Button className="w-fit" disabled={busy} onClick={onRetry}>
      {busy ? 'Audio wird erstellt …' : 'Fehlende Audiodateien erstellen'}
    </Button>
  </Callout>
);
