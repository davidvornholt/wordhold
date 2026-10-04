import { Button } from '../../../shared/ui/button';
import type { Dictation, DictationStatus } from './use-dictation';

const secondsPerMinute = 60;

const clock = (seconds: number) =>
  `${Math.floor(seconds / secondsPerMinute)}:${String(seconds % secondsPerMinute).padStart(2, '0')}`;

const labels = {
  idle: 'Diktieren',
  starting: 'Mikrofon wird gestartet …',
  recording: 'Aufnahme beenden',
  transcribing: 'Wird erkannt …',
} as const satisfies Record<DictationStatus, string>;

type DictationButtonProps = {
  readonly dictation: Dictation;
  readonly disabled: boolean;
};

// One button starts and ends a recording. While the microphone starts and the
// text is recognized it only looks disabled, so keyboard focus stays on it.
export const DictationButton = ({
  dictation,
  disabled,
}: DictationButtonProps) => {
  const { status, seconds, message } = dictation;
  const waiting = status === 'starting' || status === 'transcribing';
  const toggle = () => {
    if (status === 'recording') {
      dictation.stop().catch(() => undefined);
    } else if (status === 'idle') {
      dictation.start().catch(() => undefined);
    }
  };
  return (
    <>
      <Button
        aria-disabled={waiting}
        className="aria-disabled:opacity-50"
        disabled={disabled}
        onClick={toggle}
        variant="outline"
      >
        {status === 'recording' ? (
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-destructive motion-safe:animate-pulse"
          />
        ) : null}
        {labels[status]}
        {status === 'recording' ? (
          <span className="text-muted-foreground tabular-nums">
            {clock(seconds)}
          </span>
        ) : null}
      </Button>
      <p className="sr-only" role="status">
        {status === 'recording' ? 'Aufnahme läuft.' : ''}
        {status === 'transcribing' ? 'Die Aufnahme wird erkannt.' : ''}
      </p>
      {message === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {message}
        </p>
      )}
    </>
  );
};
