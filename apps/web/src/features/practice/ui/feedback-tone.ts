import type { CardTone } from '../../../shared/ui/word-card';
import type { SubmitResult } from '../schemas/practice-models';

// The verdict's color, shared by the card edge, the answer field and the
// reveal so one answer never shows two tones.
export const feedbackTone = (result: SubmitResult): CardTone => {
  if (!result.graded) {
    return 'warning';
  }
  return result.correct ? 'positive' : 'destructive';
};
