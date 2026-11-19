import type { FeedbackResult } from '../schemas/practice-models';
import type { SentenceOutcome } from './use-sentence-check';

// The verdict's color. Only the words naming the verdict take it; the card
// itself stays quiet whatever the answer was.
export type CardTone = 'positive' | 'destructive' | 'warning';

export const feedbackTone = (result: FeedbackResult): CardTone => {
  if (!result.graded) {
    return 'warning';
  }
  return result.correct ? 'positive' : 'destructive';
};

// A sentence given up on reads as wrong; it was not known.
export const sentenceTone = (outcome: SentenceOutcome): CardTone => {
  if (outcome.kind === 'skipped') {
    return 'destructive';
  }
  if (!outcome.result.graded) {
    return 'warning';
  }
  return outcome.result.correct ? 'positive' : 'destructive';
};

export const toneText: Record<CardTone, string> = {
  positive: 'text-primary',
  destructive: 'text-destructive',
  warning: 'text-warning-foreground',
};
