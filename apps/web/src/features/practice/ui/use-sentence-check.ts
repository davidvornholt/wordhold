import { useState } from 'react';
import type { RailOutcome } from '../../../shared/session/rail-outcome';
import type {
  SentenceAnswerData,
  SentenceResult,
} from '../schemas/sentence-models';
import { useLifetime } from './use-practice-audio';

export type CheckSentence = (input: {
  readonly data: SentenceAnswerData;
}) => Promise<SentenceResult>;

// What happened to one sentence: checked by the server, or given up on, in
// which case the stored translation is shown without asking anyone.
export type SentenceOutcome =
  | {
      readonly kind: 'checked';
      readonly answer: string;
      readonly result: SentenceResult;
    }
  | { readonly kind: 'skipped' };

export const railOutcomeOf = (outcome: SentenceOutcome): RailOutcome => {
  if (outcome.kind === 'skipped') {
    return 'wrong';
  }
  if (!outcome.result.graded) {
    return 'ungraded';
  }
  return outcome.result.correct ? 'correct' : 'wrong';
};

const checkError =
  'Deine Übersetzung konnte nicht geprüft werden. Prüfe deine Verbindung und versuche es noch einmal. Hilft das nicht, lade die Übung neu.';

type SentenceCheckInput = {
  readonly entryId: string;
  readonly sentence: string;
  readonly check: CheckSentence;
  readonly onOutcome: (outcome: SentenceOutcome) => void;
};

export const useSentenceCheck = ({
  entryId,
  sentence,
  check,
  onOutcome,
}: SentenceCheckInput) => {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SentenceOutcome | null>(null);
  const isOnScreen = useLifetime();

  const finish = (next: SentenceOutcome) => {
    setOutcome(next);
    onOutcome(next);
  };

  const submit = async () => {
    if (busy || outcome !== null || answer.trim() === '') {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await check({ data: { entryId, sentence, answer } });
      // The judge can take several seconds; a learner who left meanwhile
      // must not hear the sentence play on another page.
      if (isOnScreen()) {
        finish({ kind: 'checked', answer, result });
      }
    } catch {
      setError(checkError);
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    if (busy || outcome !== null) {
      return;
    }
    setError(null);
    finish({ kind: 'skipped' });
  };

  return { answer, setAnswer, busy, error, outcome, submit, skip } as const;
};
