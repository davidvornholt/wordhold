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
type StoredResolution = Exclude<WrongAnswerResolution, 'defer'>;

const submissionError =
  'Deine Antwort konnte nicht geprüft werden. Prüfe deine Verbindung und versuche es noch einmal.';
const resolutionError =
  'Die Bewertung konnte nicht gespeichert werden. Versuche es noch einmal.';

const createSubmissionLock = () => {
  let active = false;
  return {
    acquire: () => {
      if (active) {
        return false;
      }
      active = true;
      return true;
    },
    release: () => {
      active = false;
    },
  };
};

type CardSubmissionInput = {
  readonly cardId: string;
  readonly revision: number;
  readonly mode: DeferredSubmitData['mode'];
  readonly playFeedbackAudio: () => Promise<void>;
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
  playFeedbackAudio,
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
  const [resolution, setResolution] = useState<StoredResolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submissionLock] = useState(createSubmissionLock);

  const submitAndPresent = async (
    data: SubmitPayloadData,
    rollback: () => void,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const submitted = await submit({ data });
      setResult(submitted);
      if (submitted.graded) {
        await playFeedbackAudio();
      }
    } catch {
      rollback();
      setError(submissionError);
    } finally {
      submissionLock.release();
      setBusy(false);
    }
  };

  const submitAnswer = async () => {
    if (busy || result !== null || !submissionLock.acquire()) {
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
    if (busy || result !== null || !submissionLock.acquire()) {
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
    wrongAnswerResolution: StoredResolution,
  ) => {
    if (
      busy ||
      submittedData === null ||
      result === null ||
      !result.graded ||
      result.stored ||
      !submissionLock.acquire()
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
    } catch {
      setError(resolutionError);
    } finally {
      submissionLock.release();
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
