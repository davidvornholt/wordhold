import type { ComponentProps } from 'react';
import type { FeedbackResult } from '../schemas/practice-models';
import { FeedbackPanel } from './feedback-panel';
import {
  type OtherWordingAttempt,
  OtherWordingNotice,
} from './other-wording-notice';

type CardFeedbackProps = Omit<
  ComponentProps<typeof FeedbackPanel>,
  'result'
> & {
  readonly result: FeedbackResult | null;
  readonly otherWording: OtherWordingAttempt | null;
};

// What the card shows under its prompt: the feedback once the answer is
// judged, or, while the card is still open after an answer in other words,
// the notice about it.
export const CardFeedback = ({
  result,
  otherWording,
  ...panel
}: CardFeedbackProps) => {
  if (result !== null) {
    return <FeedbackPanel {...panel} result={result} />;
  }
  if (otherWording === null) {
    return null;
  }
  // A new key for each answer replays the notice's entrance.
  return (
    <OtherWordingNotice
      answerLanguage={panel.answerLanguage}
      attempt={otherWording}
      key={otherWording.attempt}
    />
  );
};
