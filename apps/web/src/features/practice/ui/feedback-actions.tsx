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
    <Button onClick={playWord} variant="quiet">
      Wort anhören
    </Button>
  );
};

// "Weiter" takes the place "Prüfen" had, so the hand does not move between
// answering and continuing. Everything else is secondary and sits beneath in
// a row that keeps its height and its columns: the card's own actions stay
// centred while "Audio stoppen" comes and goes in a side slot, so nothing
// moves when the sentence ends.
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
}: FeedbackActionsProps) => {
  const wordFallback = graded && example === null && playWord !== null;
  const hasOwnActions = pendingWrong || wordFallback;
  const stop = (
    <Button onClick={stopAudio} variant="quiet-muted">
      Audio stoppen
    </Button>
  );
  const centreStop = audioPlaying && !hasOwnActions;
  const sideStop = audioPlaying && hasOwnActions;
  return (
    <div className="flex flex-col gap-3">
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
      <div className="grid min-h-11 grid-cols-[1fr_auto_1fr] items-center gap-x-4">
        <span />
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
          {pendingWrong ? (
            <Button
              disabled={busy || resolution !== null}
              onClick={() => onResolveWrong('hard')}
              variant="quiet"
            >
              {resolution === 'hard'
                ? 'Wird gespeichert …'
                : 'Als richtig werten'}
            </Button>
          ) : null}
          <WordAudioFallback
            example={example}
            graded={graded}
            playWord={playWord}
          />
          {centreStop ? stop : null}
        </div>
        <div className="justify-self-start">{sideStop ? stop : null}</div>
      </div>
    </div>
  );
};
