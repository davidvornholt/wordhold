import { useState } from 'react';
import type {
  ResolvedSubmitResult,
  SubmitResult,
} from '../schemas/practice-models';
import type {
  SubmitPayloadData,
  WrongAnswerResolution,
} from '../schemas/submission-schema';

type DeferredSubmitData = Extract<
  SubmitPayloadData,
  { readonly wrongAnswerResolution: 'defer' }
>;

type CardSubmissionInput = {
  readonly cardId: string;
  readonly revision: number;
  readonly mode: DeferredSubmitData['mode'];
  readonly audioUrl: string | null;
  readonly submit: (input: {
    readonly data: SubmitPayloadData;
  }) => Promise<SubmitResult>;
  readonly onNext: (result: ResolvedSubmitResult) => void;
};

// All state around one card's answer round trip: the deferred first
// submission, the optional skip, and the resolution of a rejected answer.
export const useCardSubmission = ({
  cardId,
  revision,
  mode,
  audioUrl,
  submit,
  onNext,
}: CardSubmissionInput) => {
  const [answer, setAnswer] = useState('');
  const [submittedData, setSubmittedData] = useState<DeferredSubmitData | null>(
    null,
  );
  const [skipped, setSkipped] = useState(false);
  const [startedAt] = useState(() => performance.now());
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolution, setResolution] = useState<Exclude<
    WrongAnswerResolution,
    'defer'
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitAndPresent = async (
    data: SubmitPayloadData,
    rollback: () => void,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const submitted = await submit({ data });
      setResult(submitted);
      if (audioUrl !== null) {
        await new Audio(audioUrl).play().catch(() => undefined);
      }
    } catch (cause) {
      rollback();
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async () => {
    if (busy || result !== null) {
      return;
    }
    const data: DeferredSubmitData = {
      cardId,
      revision,
      answer,
      elapsedMs: Math.floor(performance.now() - startedAt),
      wrongAnswerResolution: 'defer',
      mode,
    };
    setSubmittedData(data);
    await submitAndPresent(data, () => setSubmittedData(null));
  };

  const skipCard = async () => {
    if (busy || result !== null) {
      return;
    }
    setSkipped(true);
    await submitAndPresent(
      {
        cardId,
        revision,
        elapsedMs: Math.floor(performance.now() - startedAt),
        skipped: true,
        mode,
      },
      () => setSkipped(false),
    );
  };

  const resolveWrongAnswer = async (
    wrongAnswerResolution: Exclude<WrongAnswerResolution, 'defer'>,
  ) => {
    if (
      busy ||
      submittedData === null ||
      result === null ||
      !result.graded ||
      result.stored
    ) {
      return;
    }
    setBusy(true);
    setResolution(wrongAnswerResolution);
    setError(null);
    try {
      const submitted = await submit({
        data: {
          ...submittedData,
          wrongAnswerResolution,
          assessmentId: result.assessmentId,
        },
      });
      if (submitted.graded && !submitted.stored) {
        throw new Error('Die Antwort wurde noch nicht gespeichert.');
      }
      setResult(submitted);
      onNext(submitted);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
      setResolution(null);
    }
  };

  return {
    answer,
    setAnswer,
    submittedAnswer: submittedData?.answer ?? null,
    skipped,
    result,
    busy,
    resolution,
    error,
    submitAnswer,
    skipCard,
    resolveWrongAnswer,
  };
};
