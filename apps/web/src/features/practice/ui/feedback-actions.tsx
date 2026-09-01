import type { RefObject } from 'react';
import type { PreparedExampleSentence } from '../../../shared/examples/example-model';
import { Button } from '../../../shared/ui/button';
import type { WrongAnswerResolution } from '../schemas/submission-schema';

type FeedbackActionsProps = {
  readonly audioPlaying: boolean;
  readonly busy: boolean;
  readonly example: PreparedExampleSentence | null;
  readonly feedbackDescriptionId: string;
  readonly graded: boolean;
  readonly nextButton: RefObject<HTMLButtonElement | null>;
  readonly onNext: () => void;
  readonly onResolveWrong: (
    resolution: Exclude<WrongAnswerResolution, 'defer'>,
  ) => void;
  readonly pendingWrong: boolean;
  readonly playWord: (() => Promise<void>) | null;
  readonly resolution: Exclude<WrongAnswerResolution, 'defer'> | null;
  readonly stopAudio: () => void;
};

const WordAudioFallback = ({
  example,
  graded,
  playWord,
}: Pick<FeedbackActionsProps, 'example' | 'graded' | 'playWord'>) => {
  if (!graded || example !== null || playWord === null) {
    return null;
  }
  return (
    <Button onClick={playWord} variant="outline">
      Wort anhören
    </Button>
  );
};

export const FeedbackActions = ({
  audioPlaying,
  busy,
  example,
  feedbackDescriptionId,
  graded,
  nextButton,
  onNext,
  onResolveWrong,
  pendingWrong,
  playWord,
  resolution,
  stopAudio,
}: FeedbackActionsProps) => (
  <div className="flex flex-wrap items-center gap-3">
    {audioPlaying ? (
      <Button onClick={stopAudio} variant="outline">
        Audio stoppen
      </Button>
    ) : null}
    <WordAudioFallback example={example} graded={graded} playWord={playWord} />
    {pendingWrong ? (
      <Button
        disabled={busy || resolution !== null}
        onClick={() => onResolveWrong('hard')}
        variant="outline"
      >
        {resolution === 'hard' ? 'Wird gespeichert …' : 'Als richtig werten'}
      </Button>
    ) : null}
    <Button
      aria-describedby={feedbackDescriptionId}
      disabled={busy || resolution !== null}
      onClick={() => {
        if (pendingWrong) {
          onResolveWrong('again');
        } else {
          onNext();
        }
      }}
      ref={nextButton}
    >
      {resolution === 'again' ? 'Wird gespeichert …' : 'Weiter'}
    </Button>
  </div>
);
