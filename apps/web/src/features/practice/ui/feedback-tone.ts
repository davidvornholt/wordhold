import type { CardTone } from '../../../shared/ui/word-card';
import type { SubmitResult } from '../schemas/practice-models';
import type { SentenceOutcome } from './use-sentence-check';

// The verdict's color, shared by the card edge, the answer field and the
// reveal so one answer never shows two tones.
export const feedbackTone = (result: SubmitResult): CardTone => {
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

// The heading, the divider above the reveal and the answer field's border
// take the same tone.
export const toneText: Record<CardTone, string> = {
  neutral: 'text-foreground',
  positive: 'text-primary',
  destructive: 'text-destructive',
  warning: 'text-warning-foreground',
};

export const toneDivider: Record<CardTone, string> = {
  neutral: 'border-border',
  positive: 'border-primary',
  destructive: 'border-destructive',
  warning: 'border-warning-foreground',
};

export const toneField: Record<CardTone, string> = {
  neutral: 'border-input',
  positive: 'border-primary',
  destructive: 'border-destructive',
  warning: 'border-warning-foreground',
};
