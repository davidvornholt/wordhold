import type { CourseKind } from '@wordhold/db/schema/courses';
import type { RefObject } from 'react';
import { ActionBar } from '../../../shared/ui/action-bar';
import { Button } from '../../../shared/ui/button';
import type { WrongAnswerResolution } from '../schemas/submission-schema';

type CheckActionsProps = {
  // Neither checking nor skipping can start: the card is saving, or a
  // recording is still being written out.
  readonly blocked: boolean;
  readonly checking: boolean;
  readonly empty: boolean;
  readonly nextButtonRef: RefObject<HTMLButtonElement | null>;
  readonly onSkip: () => void;
  readonly skipping: boolean;
};

// Before the verdict: check the answer, or give up on the card.
export const CheckActions = ({
  blocked,
  checking,
  empty,
  nextButtonRef,
  onSkip,
  skipping,
}: CheckActionsProps) => (
  <ActionBar
    primary={
      <Button disabled={blocked || empty} ref={nextButtonRef} type="submit">
        {checking ? 'Wird geprüft …' : 'Prüfen'}
      </Button>
    }
    secondary={
      <Button disabled={blocked} onClick={onSkip} variant="quiet-muted">
        {skipping ? 'Wird gespeichert …' : 'Weiß ich nicht'}
      </Button>
    }
  />
);

// Overruling a rejected answer: a word was only mistyped, or a definition
// states everything after all. Either way the card comes back a little
// sooner than after a right first answer.
const overruleLabels = {
  language: {
    question: 'Vertippt?',
    consequence:
      'Die Karte kommt etwas früher wieder als nach einer auf Anhieb richtigen Antwort, und deine Antwort wird nicht als weitere Lösung gespeichert.',
  },
  terms: {
    question: 'Steht doch alles drin?',
    consequence:
      'Die Karte kommt etwas früher wieder als nach einer auf Anhieb richtigen Antwort.',
  },
} as const;

type ContinueActionsProps = {
  readonly busy: boolean;
  readonly feedbackId: string;
  readonly kind: CourseKind;
  readonly nextButtonRef: RefObject<HTMLButtonElement | null>;
  // The answer was rejected and is not stored yet, so it can be overruled.
  readonly overrulable: boolean;
  readonly onOverrule: () => void;
  readonly resolution: Exclude<WrongAnswerResolution, 'defer'> | null;
  // A missed answer has to be written out before the card moves on.
  readonly retypeMissing: boolean;
};

// After the verdict: move on, or first count a rejected answer as right. A
// recited text is never held back for overruling.
export const ContinueActions = ({
  busy,
  feedbackId,
  kind,
  nextButtonRef,
  overrulable,
  onOverrule,
  resolution,
  retypeMissing,
}: ContinueActionsProps) => {
  const saving = busy || resolution !== null;
  return (
    <ActionBar
      primary={
        <Button
          aria-describedby={feedbackId}
          disabled={saving || retypeMissing}
          ref={nextButtonRef}
          type="submit"
        >
          {resolution === 'again' ? 'Wird gespeichert …' : 'Weiter'}
        </Button>
      }
      secondary={
        overrulable && kind !== 'texts' ? (
          <p className="text-muted-foreground text-sm">
            {overruleLabels[kind].question}{' '}
            <Button
              className="text-foreground"
              disabled={saving}
              onClick={onOverrule}
              title={overruleLabels[kind].consequence}
              variant="quiet"
            >
              {resolution === 'hard'
                ? 'Wird gespeichert …'
                : 'Als richtig werten'}
            </Button>
          </p>
        ) : null
      }
    />
  );
};
