import { Button } from '../../../shared/ui/button';

type ExtractionRecoveryProps = {
  readonly busy: boolean;
  readonly onRetry: () => void;
};

export const ExtractionRecovery = ({
  busy,
  onRetry,
}: ExtractionRecoveryProps) => (
  <div aria-busy={busy} className="flex flex-col items-start gap-3">
    <p className="text-muted-foreground text-sm">
      Die Seite wurde noch nicht ausgelesen oder das Auslesen ist
      fehlgeschlagen.
    </p>
    <Button disabled={busy} onClick={onRetry}>
      {busy ? 'Wird gelesen …' : 'Erneut auslesen'}
    </Button>
  </div>
);
