import { Button } from '../../../shared/ui/button';

type ExtractionRecoveryProps = {
  readonly message: string;
  readonly disabled: boolean;
  readonly retrying: boolean;
  readonly onRetry: () => void;
};

export const ExtractionRecovery = ({
  message,
  disabled,
  retrying,
  onRetry,
}: ExtractionRecoveryProps) => (
  <div aria-busy={retrying} className="flex flex-col items-start gap-3">
    <p className="text-muted-foreground text-sm">{message}</p>
    <Button disabled={disabled} onClick={onRetry}>
      {retrying ? 'Wird gelesen …' : 'Erneut auslesen'}
    </Button>
  </div>
);
